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
import * as admin from "firebase-admin";
import {GeoPoint} from "firebase-admin/firestore";
import type {PickDropRequest, WALocation} from "./types";
import {findTitleInSections, sendPickDropList, putRequest, sendReminder, setExpiredRequests,
  sendCTAUrl, convertUserTime, processTextMessage, acceptLocation, markRead} from "./functions";
import {ALL_SECTIONS, PICK_REPLY, DROP_REPLY, EDIT_PICK_REPLY,
  EDIT_DROP_REPLY, TIMEZONE, app} from "./constants";
import {DateTime} from "luxon";

const {WEBHOOK_VERIFY_TOKEN} = process.env;

initializeApp();

app.get("/populate/locations", async (req: Request, res: Response) => {
  await admin.firestore().collection("locations").add({
    shortname: "Seetharam Palaya Metro",
    placename: "Seetharam Palya Metro Station",
    coordinates: new GeoPoint(12.980939179894557, 77.70863125205479),
    placeid: "ChIJsUHA1f8RrjsRsk2ztqTF2kQ",
    routekey: "metro",
  });

  await admin.firestore().collection("locations").add({
    shortname: "Schenider - Argon North",
    placename: "Bagmane Argon",
    coordinates: new GeoPoint(12.971506601103457, 77.71077754000429),
    placeid: "ChIJ02GMFAATrjsRjGa_utASi_w",
    routekey: "argon",
  });

  await admin.firestore().collection("locations").add({
    shortname: "Bagmane Xenon",
    placename: "Bagmane Xenon",
    coordinates: new GeoPoint(12.971182334638064, 77.70853220585103),
    placeid: "ChIJI_q8OnsTrjsRfgm5xIdKTt4",
    routekey: "xenon",
  });

  await admin.firestore().collection("locations").add({
    shortname: "Bagmane Neon",
    placename: "Bagmane Neon",
    coordinates: new GeoPoint(12.972551970202218, 77.70884659780394),
    placeid: "ChIJq8nbVlsTrjsR80URA0Zth5M",
    routekey: "neon",
  });

  res.sendStatus(200);
});

app.get("/fake-trigger/put-request", async (req: Request, res: Response) => {
  await putRequest("pick", "91aaaaaaaaaa", "09:30 AM");
  await putRequest("pick", "91bbbbbbbbbb", "09:30 AM");
  await putRequest("drop", "91aaaaaaaaaa", "04:30 PM");
  await putRequest("drop", "91aaaaaaaaaa", "07:30 PM");
  res.sendStatus(200);
});

app.get("/test/:messageFor/:time", async (req: Request, res: Response) => {
  const messageFor = req.params.messageFor as string;
  const time = req.params.time as string;

  // Fetch this from WA webhook
  const currentWALocation = {latitude: 12.969051361084, longitude: 77.733055114746} as WALocation;

  console.log("Fake trigger URL", currentWALocation, messageFor, time);

  await acceptLocation(messageFor, currentWALocation, time);

  res.sendStatus(200);
});


app.get("/fake-trigger/scheduler/:time", async (req: Request, res: Response) => {
  const time = req.params.time as string;

  const {userDateNowIndia} = convertUserTime(time);

  console.log("Fake trigger", userDateNowIndia);

  await setExpiredRequests(userDateNowIndia);
  await sendReminder(userDateNowIndia);

  res.sendStatus(200);
});

app.get("/fake-trigger/send-url/:messageFor/:time", async (req: Request, res: Response) => {
  const messageFor = req.params.messageFor as string;
  const time = req.params.time as string;

  console.log("Fake trigger URL", messageFor, time);

  const messageBody1 = "I'm on my way. See my trip progress and arrival time " +
  "on Maps: https://maps.app.goo.gl/7FMyKW9SWJ7JiWEkq";

  // const messageBody2 = "Hi";

  await processTextMessage(messageBody1, messageFor, time);

  res.sendStatus(200);
});

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
  if (message?.type === "location") {
    const currentWALocation = message.location as WALocation;
    await acceptLocation(messageFrom, currentWALocation);
    await markRead(message.id);
  }

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
    await markRead(message.id);
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

    const todayNowJS = DateTime.now().setZone(TIMEZONE);
    await setExpiredRequests(todayNowJS);
    await sendReminder(todayNowJS);
  });
