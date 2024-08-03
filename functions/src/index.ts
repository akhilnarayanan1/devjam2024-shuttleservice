/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

import * as logger from "firebase-functions/logger";
import {onRequest} from "firebase-functions/v2/https";
import {onSchedule} from "firebase-functions/v2/scheduler";
import {initializeApp} from "firebase-admin/app";
import type {Request, Response} from "express";
import * as express from "express";
import * as _ from "lodash";
import axios from "axios";
import type {PickDropRequest, RequestStore} from "./types";
import {findTitleInSections, sendChoice, sendPickDropList, populateRequest,
  putRequest, setExpiredRequests, sendCTAUrl, convertUserTime, sendReminder} from "./functions";
import {ALL_SECTIONS, PICK_REPLY, DROP_REPLY, EDIT_PICK_REPLY,
  EDIT_DROP_REPLY, MESSAGES_URL, TIMEZONE} from "./constants";
import {DateTime} from "luxon";

const {GRAPH_API_TOKEN, WEBHOOK_VERIFY_TOKEN} = process.env;

const app = express();
app.use(express.json());
initializeApp();

// app.get("/populate", async (req: Request, res: Response) => {
//   await admin.firestore().collection("locations").add({
//     shortname: "Seetharam Palaya Metro",
//     placename: "Seetharam Palya Metro Station",
//     placeid: "ChIJsUHA1f8RrjsRsk2ztqTF2kQ",
//     routekey: "metro",
//   });

//   await admin.firestore().collection("locations").add({
//     shortname: "Schenider - Argon North",
//     placename: "Bagmane Argon",
//     placeid: "ChIJ02GMFAATrjsRjGa_utASi_w",
//     routekey: "argon",
//   });

//   await admin.firestore().collection("locations").add({
//     shortname: "Bagmane Xenon",
//     placename: "Bagmane Xenon",
//     placeid: "ChIJI_q8OnsTrjsRfgm5xIdKTt4",
//     routekey: "xenon",
//   });

//   await admin.firestore().collection("locations").add({
//     shortname: "Bagmane Neon",
//     placename: "Bagmane Neon",
//     placeid: "ChIJq8nbVlsTrjsR80URA0Zth5M",
//     routekey: "neon",
//   });

//   res.sendStatus(200);
// });

app.get("/fake-trigger/:time", async (req: Request, res: Response) => {
  const time = req.params.time as string;

  const {userDateNowIndia} = convertUserTime(time);

  console.log("Fake trigger", userDateNowIndia);

  await setExpiredRequests(userDateNowIndia);
  await sendReminder(userDateNowIndia);

  res.sendStatus(200);
});

app.post("/webhook", async (req: Request, res: Response) => {
  // check if the webhook request contains a message
  const message = req.body.entry?.[0]?.changes[0]?.value?.messages?.[0];

  const messageFrom = message?.from;

  if (message?.type === "interactive" && message?.interactive?.type === "button_reply") {
    if (JSON.stringify(message?.interactive?.button_reply) === JSON.stringify(PICK_REPLY)) {
      await sendPickDropList(messageFrom, "pick");
    }
    if (JSON.stringify(message?.interactive?.button_reply) === JSON.stringify(DROP_REPLY)) {
      await sendPickDropList(messageFrom, "drop");
    }
    if (JSON.stringify(message?.interactive?.button_reply) === JSON.stringify(EDIT_PICK_REPLY)) {
      await sendPickDropList(messageFrom, "pick");
    }
    if (JSON.stringify(message?.interactive?.button_reply) === JSON.stringify(EDIT_DROP_REPLY)) {
      await sendPickDropList(messageFrom, "drop");
    }
  }

  if (message?.type === "interactive" && message?.interactive?.type === "list_reply") {
    const shuttleTimings = message?.interactive?.list_reply;
    const time = shuttleTimings?.title;
    const pickOrDrop = findTitleInSections(shuttleTimings, ALL_SECTIONS) as PickDropRequest;

    // UPDATE DB
    // if (isTimeValid(time)) {
    const {routeMessage, mapsUrl} = await putRequest(pickOrDrop, messageFrom, time);
    await sendCTAUrl(messageFrom, "🚀 Route plan 🚀", routeMessage, "Open Map", mapsUrl);
    // } else {
    //   await normalMessage(messageFrom, "Invalid time requested");
    // }
  }

  // check if the incoming message contains text
  if (message?.type === "text") {
    const buttonsEditPickType = [
      {type: "reply", reply: EDIT_PICK_REPLY},
      {type: "reply", reply: DROP_REPLY},
    ];

    const buttonsEditDropType = [
      {type: "reply", reply: PICK_REPLY},
      {type: "reply", reply: EDIT_DROP_REPLY},
    ];

    const buttonsEditPickDropType = [
      {type: "reply", reply: EDIT_PICK_REPLY},
      {type: "reply", reply: EDIT_DROP_REPLY},
    ];

    const buttonsPickDropType = [
      {type: "reply", reply: PICK_REPLY},
      {type: "reply", reply: DROP_REPLY},
    ];

    let requests: RequestStore[] = [];
    requests = await populateRequest(messageFrom);

    if (requests.length > 0) {
      const hasPickType = _.some(requests, ["data.type", "pick"]);
      const hasDropType = _.some(requests, ["data.type", "drop"]);
      const filteredPick = _.filter(requests, ["data.type", "pick"]);
      const filteredDrop = _.filter(requests, ["data.type", "drop"]);

      const editHeader = "Edit/New Route Type";

      if (hasPickType && hasDropType) {
        const editBody = `You already both pickup at (${filteredPick[0].data.time}) 
          & drop at (${filteredDrop[0].data.time}). Edit it?`;
        await sendChoice(messageFrom, editHeader, editBody, buttonsEditPickDropType);
      } else if (hasPickType) {
        const editBody = `You already have a pickup at (${filteredPick[0].data.time}). Edit it?`;
        await sendChoice(messageFrom, editHeader, editBody, buttonsEditPickType);
      } else {
        const editBody = `You already have a drop at(${filteredDrop[0].data.time}). Edit it?`;
        await sendChoice(messageFrom, editHeader, editBody, buttonsEditDropType);
      }
    } else {
      // else send fresh message to register.
      const editBody = "Please select the route type";
      await sendChoice(messageFrom, "Pick Route Type", editBody, buttonsPickDropType);
    }

    // mark incoming message as read
    await axios({
      method: "POST",
      url: MESSAGES_URL,
      headers: {Authorization: `Bearer ${GRAPH_API_TOKEN}`},
      data: {
        messaging_product: "whatsapp",
        status: "read",
        message_id: message.id,
      },
    });
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

    const todayNowJS = DateTime.now().setZone(TIMEZONE);
    await setExpiredRequests(todayNowJS);
    await sendReminder(todayNowJS);
  });
