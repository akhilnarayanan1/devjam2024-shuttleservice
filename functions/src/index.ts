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
import * as express from "express";
import axios from "axios";
import type {Request, Response} from "express";
import {initializeApp} from "firebase-admin/app";
import * as admin from "firebase-admin";
import {FieldValue} from "firebase-admin/firestore";

const {WEBHOOK_VERIFY_TOKEN, GRAPH_API_TOKEN, GRAPH_API_VERSION, BUSINESS_WA_NO} = process.env;

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
//     placename: "Argon North",
//     placeid: "ChIJ02GMFAATrjsRjGa_utASi_w",
//     routekey: "office",
//   });

//   res.sendStatus(200);
// });

// app.get("/test", async (req: Request, res: Response) => {
//   const shuttleTimings = {id: "7", title: "10:45 AM"};
//   const time = shuttleTimings?.title;
//   const pickOrDrop = findTitleInSections(shuttleTimings, allSections) as PickDropRequest;

//   if (isUpdateEligible(time)) {
//     await putRequest(pickOrDrop, "917987089820", time);
//     await normalMessage("917987089820", "Scheduled for " + pickOrDrop + " at " + time + ".");
//   } else {
//     await normalMessage("917987089820", "Invalid time requested");
//   }

//   res.sendStatus(200);
// });


interface Location {
  shortname: string,
  placename: string,
  placeid: string,
  routekey?: "office" | "metro",
}

interface LocationStore {
  id: string;
  place: Location
}

type PickDropRequest = "pick" | "drop";

const isUpdateEligible = (timeString: string) => {
  // Split the time string into hours, minutes, and AM/PM
  const [time, period] = timeString.split(" ");
  const [hours, minutes] = time.split(":");

  // Convert hours to 24-hour format
  let hour = parseInt(hours, 10);
  const minute = parseInt(minutes, 10);
  if (period === "PM" && hour !== 12) {
    hour += 12;
  } else if (period === "AM" && hour === 12) {
    hour = 0;
  }

  // Calculate the offset for UTC+5:30 in milliseconds
  const offsetMilliseconds = 5 * 60 * 60 * 1000 + 30 * 60 * 1000;

  // Create a Date object for today in UTC
  const todayNowUTC = new Date();
  const fullYearIndia = new Date(todayNowUTC.getTime() + offsetMilliseconds).getFullYear();
  const monthIndia = new Date(todayNowUTC.getTime() + offsetMilliseconds).getMonth();
  const dateIndia = new Date(todayNowUTC.getTime() + offsetMilliseconds).getDate();

  // Create another Date object for today in UTC+5:30 with specified hour and minute
  const userDateNowIndia = new Date(fullYearIndia, monthIndia, dateIndia, hour, minute, 0, 0);

  const userDateNowUTC = new Date(userDateNowIndia.getTime() - offsetMilliseconds);

  // Calculate the difference in milliseconds
  const diff = todayNowUTC.getTime() - userDateNowUTC.getTime();
  const diffInSeconds = diff / 1000;

  return diffInSeconds < 0 ? true: false;
};


const putRequest = async (requestType: PickDropRequest, user: string, time: string) => {
  const locations: LocationStore[] = [];
  let from = {} as LocationStore;
  let to = {} as LocationStore;

  await admin.firestore().collection("locations").get().then((querySnapshot) => {
    querySnapshot.forEach((doc) => {
      locations.push({id: doc.id, place: doc.data() as Location});
    });
  });

  if (requestType === "pick") {
    from = locations.find((location) => location.place?.routekey === "metro") as LocationStore;
    to = locations.find((location) => location.place?.routekey === "office") as LocationStore;
  } else {
    from = locations.find((location) => location.place.routekey === "office") as LocationStore;
    to = locations.find((location) => location.place.routekey === "metro") as LocationStore;
  }

  await admin.firestore().collection("request").add({
    type: requestType,
    from: from,
    to: to,
    for: user,
    time: time,
    createdAt: FieldValue.serverTimestamp(),
  });
};


const MESSAGES_URL = `https://graph.facebook.com/${GRAPH_API_VERSION}/${BUSINESS_WA_NO}/messages`;

const pickReply = {id: "1", title: "Pick"};
const dropReply = {id: "2", title: "Drop"};

const pickSection = {
  title: "pick",
  rows: [
    {id: "1", title: "08:30 AM"},
    {id: "2", title: "08:50 AM"},
    {id: "3", title: "09:10 AM"},
    {id: "4", title: "09:30 AM"},
    {id: "5", title: "09:50 AM"},
    {id: "6", title: "10:15 AM"},
    {id: "7", title: "10:45 AM"},
    {id: "8", title: "11:15 AM"},
  ],
};

const dropSection = {
  title: "drop",
  rows: [
    {id: "1", title: "04:30 PM"},
    {id: "2", title: "04:50 PM"},
    {id: "3", title: "05:10 PM"},
    {id: "4", title: "05:30 PM"},
    {id: "5", title: "05:50 PM"},
    {id: "6", title: "06:10 PM"},
    {id: "7", title: "06:30 PM"},
    {id: "8", title: "07:00 PM"},
    {id: "9", title: "07:30 PM"},
  ],
};

const allSections = [pickSection, dropSection];

const findTitleInSections = (input: {id: string, title: string},
  sections: {title: string, rows: {id: string, title: string}[]}[]) => {
  for (const section of sections) {
    const foundRow = section.rows.find((row) => row.id === input.id && row.title === input.title);
    if (foundRow) {
      return section.title;
    }
  }
  return null; // Not found
};

const sendPickDropList = async (messageFrom: string, routeType: PickDropRequest) => {
  let messageText = "";
  let actionButtonText = "";
  let section = {};
  if (routeType === "pick") {
    messageText = "📍*Pickup* - Seetharam Palaya Metro\n\n📍*Drop* - Schneider - Argon North\n\n🚗💨";
    section = pickSection;
    actionButtonText = "Pickup timings";
  }
  if (routeType === "drop") {
    messageText = "📍*Pickup* - Schneider - Argon North\n\n📍*Drop* - Seetharam Palaya Metro \n\n🚗💨";
    section = dropSection;
    actionButtonText = "Drop timings";
  }
  await axios({
    method: "POST",
    url: MESSAGES_URL,
    headers: {Authorization: `Bearer ${GRAPH_API_TOKEN}`},
    data: {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: messageFrom,
      type: "interactive",
      interactive: {
        type: "list",
        header: {type: "text", text: "Route Plans"},
        body: {text: messageText},
        action: {
          sections: [section],
          button: actionButtonText,
        },
      },
    },
  });
};


const sendChoice = async (messageFrom: string) => {
  await axios({
    method: "POST",
    url: MESSAGES_URL,
    headers: {Authorization: `Bearer ${GRAPH_API_TOKEN}`},
    data: {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: messageFrom,
      type: "interactive",
      interactive: {
        type: "button",
        header: {type: "text", text: "Pick Route Type"},
        body: {text: "<BODY_TEXT>"},
        action: {
          buttons: [
            {type: "reply", reply: pickReply},
            {type: "reply", reply: dropReply},
          ],
        },
      },
    },
  });
};

const normalMessage = async (messageFrom: string, messageBody: string) => {
  await axios({
    method: "POST",
    url: MESSAGES_URL,
    headers: {Authorization: `Bearer ${GRAPH_API_TOKEN}`},
    data: {
      messaging_product: "whatsapp",
      to: messageFrom,
      text: {body: messageBody},
    },
  });
};


app.post("/webhook", async (req: Request, res: Response) => {
  // check if the webhook request contains a message
  const message = req.body.entry?.[0]?.changes[0]?.value?.messages?.[0];

  const messageFrom = message?.from;

  if (message?.type === "interactive" && message?.interactive?.type === "button_reply") {
    if (JSON.stringify(message?.interactive?.button_reply) === JSON.stringify(pickReply)) {
      await sendPickDropList(messageFrom, "pick");
    }
    if (JSON.stringify(message?.interactive?.button_reply) === JSON.stringify(dropReply)) {
      await sendPickDropList(messageFrom, "drop");
    }
  }

  if (message?.type === "interactive" && message?.interactive?.type === "list_reply") {
    const shuttleTimings = message?.interactive?.list_reply;
    const time = shuttleTimings?.title;
    const pickOrDrop = findTitleInSections(shuttleTimings, allSections) as PickDropRequest;

    // UPDATE DB
    if (isUpdateEligible(time)) {
      await putRequest(pickOrDrop, messageFrom, time);
      await normalMessage(messageFrom, "Scheduled for " + pickOrDrop + " at " + time + ".");
    } else {
      await normalMessage(messageFrom, "Invalid time requested");
    }
  }

  // check if the incoming message contains text
  if (message?.type === "text") {
    // Check in DB if any pending request to fulfil


    // else send fresh message to register.
    await sendChoice(messageFrom);

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
