import * as logger from "firebase-functions/logger";
import {onRequest} from "firebase-functions/v2/https";
import {onSchedule} from "firebase-functions/v2/scheduler";
import {initializeApp} from "firebase-admin/app";
import type {Request, Response} from "express";
import * as express from "express";
import {populateLocations, populateRequest, fakeScheduler, fakeSendUrl, validateLocation} from "./fake-triggers";
import {findTitleInSections, sendPickDropList, putRequest, sendReminder, setExpiredRequests,
  sendCTAUrl, processTextMessage, markRead, calculateTodayNowJS} from "./functions";
import {ALL_SECTIONS, TIMEZONE, PICK_REPLY, EDIT_PICK_REPLY, DROP_REPLY, EDIT_DROP_REPLY} from "./constants";

const {WEBHOOK_VERIFY_TOKEN} = process.env;

const app = express();
app.use(express.json());
initializeApp();

app.get("/populate/locations", populateLocations);
app.get("/fake/put-request", populateRequest);
app.get("/fake/validate-location/:messageFor/:time", validateLocation);
app.get("/fake/scheduler/:time", fakeScheduler);
app.get("/fake/send-url/:messageFor/:time", fakeSendUrl);

app.post("/webhook", async (req: Request, res: Response) => {
  // check if the webhook request contains a message
  const message = req.body.entry?.[0]?.changes[0]?.value?.messages?.[0];
  const messageFrom = message?.from;

  // check if the incoming message contains text
  if (message?.type === "text") {
    await processTextMessage(message.text.body, messageFrom);
    await markRead(message.id);
  }

  // check if the incoming message contains location
  // if (message?.type === "location") {
  //   const currentWALocation = message.location;
  //   await acceptLocation(messageFrom, currentWALocation);
  //   await markRead(message.id);
  // }


  // check if the incoming message interactive reply
  if (message?.type === "interactive") {
    if (message?.interactive?.type === "button_reply") {
      if (JSON.stringify(message?.interactive?.button_reply) === JSON.stringify(PICK_REPLY) ||
        JSON.stringify(message?.interactive?.button_reply) === JSON.stringify(EDIT_PICK_REPLY)) {
        await sendPickDropList(messageFrom, "pick");
      }
      if (JSON.stringify(message?.interactive?.button_reply) === JSON.stringify(DROP_REPLY) ||
        JSON.stringify(message?.interactive?.button_reply) === JSON.stringify(EDIT_DROP_REPLY)) {
        await sendPickDropList(messageFrom, "drop");
      }
    }

    if (message?.interactive?.type === "list_reply") {
      const shuttleTimings = message?.interactive?.list_reply;
      const time = shuttleTimings?.title;
      const pickOrDrop = findTitleInSections(shuttleTimings, ALL_SECTIONS);

      // UPDATE DB
      // if (isTimeValid(time)) {
      const {routeMessage, mapsUrl} = await putRequest(pickOrDrop, messageFrom, time);
      await sendCTAUrl(messageFrom, "🚀 Route plan 🚀", routeMessage, "Open Map", mapsUrl);
      // } else {
      //   await normalMessage(messageFrom, "Invalid time requested");
      // }
    }
    await markRead(message.id);
  }

  res.sendStatus(200);
});


app.get("/webhook", (req: Request, res: Response) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  logger.info("Request Body", req.query);
  logger.info("Token", WEBHOOK_VERIFY_TOKEN);

  // check the mode and token sent are correct
  if (mode === "subscribe" && token === WEBHOOK_VERIFY_TOKEN) {
    // respond with 200 OK and challenge token from the request
    res.status(200).send(challenge);
    console.log("Webhook verified successfully!");
  } else {
    // respond with '403 Forbidden' if verify tokens do not match
    res.sendStatus(403);
  }
});

exports.api = onRequest(app);

exports.api_schedule = onSchedule(
  {schedule: "5,10,25,40,45 8-11,16-19 * * *", timeZone: TIMEZONE},
  async (event) => {
    logger.log("Scheduled function triggered", event);

    const todayNowJS = calculateTodayNowJS();
    await setExpiredRequests(todayNowJS);
    await sendReminder(todayNowJS);
  });
