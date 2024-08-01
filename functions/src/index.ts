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
import type {Timestamp} from "firebase-admin/firestore";
import {DateTime} from "luxon";
import * as _ from "lodash";

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

// app.get("/test", async (req: Request, res: Response) => {
 
//   // await putRequest("drop", "917987089820", "06:30 PM");
//   res.sendStatus(200);
// });

interface RequestStore {
  id: string,
  data: {
    type: PickDropRequest,
    routemap: string,
    time: string,
    pending: boolean,
    createdAt: Timestamp,
  }
}


interface Location {
  shortname: string,
  placename: string,
  placeid: string,
  routekey: string,
}

interface LocationStore {
  id: string;
  place: Location
}

type PickDropRequest = "pick" | "drop";

const populateRequest = async (messageFrom: string) => {
  const requests: RequestStore[] = [];
  await admin.firestore().collection("request")
    .where("for", "==", messageFrom)
    .where("pending", "==", true)
    .get().then((querySnapshot) => {
      querySnapshot.forEach((doc) => {
        requests.push({id: doc.id, data: doc.data()} as RequestStore);
      });
    });
  return requests;
};

const convertUserTime = (timeString: string) => {
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

  // Create a Date object for today in UTC
  const todayNowIndia = DateTime.now().setZone("Asia/Kolkata");
  const fullYearIndia = todayNowIndia.year;
  const monthIndia = todayNowIndia.month;
  const dateIndia = todayNowIndia.day;

  // Create another Date object for today in UTC+5:30 with specified hour and minute
  const userDateNowIndia = todayNowIndia.set({
    year: fullYearIndia,
    month: monthIndia,
    day: dateIndia,
    hour: hour,
    minute: minute,
    second: 0,
    millisecond: 0,
  });

  return {todayNowIndia, userDateNowIndia};
};

const isUpdateEligible = (timeString: string) => {
  const {todayNowIndia, userDateNowIndia} = convertUserTime(timeString);

  // Calculate the difference in milliseconds
  const diff = todayNowIndia.toMillis() - userDateNowIndia.toMillis();
  const diffInSeconds = diff / 1000;

  return diffInSeconds < 0 ? true: false;
};

const createMapsUrl = (locations: LocationStore[], route: string[]) => {
  const originVal = locations.find((location) => location.place?.routekey === route.at(0)) as LocationStore;
  const destinationVal = locations.find((location) => location.place?.routekey === route.at(-1)) as LocationStore;

  const origin = encodeURIComponent(originVal.place.placename);
  const origin_place_id = originVal.place.placeid;

  const destination = encodeURIComponent(destinationVal.place.placename);
  const destination_place_id = destinationVal.place.placeid;

  const waypoints = route.slice(1, -1).reduce((joinedString, waypoint) => {
    const waypointVal = locations.find((location) => location.place?.routekey === waypoint) as LocationStore;
    return joinedString ? `${encodeURIComponent(joinedString+"|"+waypointVal.place.placename)}` 
      : encodeURIComponent(waypointVal.place.placename);
  }, "");

  const waypoint_place_ids = route.slice(1, -1).reduce((joinedString, waypoint) => {
    const waypointVal = locations.find((location) => location.place?.routekey === waypoint) as LocationStore;
    return joinedString ? `${encodeURIComponent(joinedString+"|"+waypointVal.place.placeid)}` 
      : encodeURIComponent(waypointVal.place.placeid);
  }, "");
    
  const mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${origin}&
    origin_place_id=${origin_place_id}&destination=${destination}&
    destination_place_id=${destination_place_id}&waypoints=${waypoints}&
    waypoint_place_ids=${waypoint_place_ids}&travelmode=driving&dir_action=navigate`;
  
  return mapsUrl;
};

const putRequest = async (requestType: PickDropRequest, user: string, time: string) => {
  const locations: LocationStore[] = [];
  const {userDateNowIndia} = convertUserTime(time);
  await admin.firestore().collection("locations").get().then((querySnapshot) => {
    querySnapshot.forEach((doc) => {
      locations.push({id: doc.id, place: doc.data() as Location});
    });
  });

  let mapsUrl = "";

  if (requestType === "pick") {
    const route = ["metro", "neon", "xenon", "argon"];
    mapsUrl += createMapsUrl(locations, route);
  } else {
    const route = ["xenon", "neon", "argon", "metro"];
    mapsUrl += createMapsUrl(locations, route);
  }

  const payload = {
    type: requestType,
    routemap: mapsUrl,
    for: user,
    time: time,
    timeindia: userDateNowIndia.toJSDate(),
    pending: true,
    createdAt: FieldValue.serverTimestamp(),
  };

  const request = await populateRequest(user);
  console.log(payload, request, requestType, _.some(request, ["data.type", requestType]));
  if (_.some(request, ["data.type", requestType]) ) {
    const docid = _.filter(request, ["data.type", requestType])[0].id;
    await admin.firestore().collection("request").doc(docid).update(payload);
  } else {
    await admin.firestore().collection("request").add(payload);
  }
};


const MESSAGES_URL = `https://graph.facebook.com/${GRAPH_API_VERSION}/${BUSINESS_WA_NO}/messages`;

const pickReply = {id: "1", title: "Pick"};
const dropReply = {id: "2", title: "Drop"};
const editPickReply = {id: "3", title: "Edit Pick"};
const editDropReply = {id: "4", title: "Edit Drop"};

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


const sendChoice = async (
  messageFrom: string,
  headerText: string,
  bodyText: string,
  buttons: {type: string, reply: {id: string, title: string}}[]
) => {
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
        header: {type: "text", text: headerText},
        body: {text: bodyText},
        action: {
          buttons: buttons,
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
    if (JSON.stringify(message?.interactive?.button_reply) === JSON.stringify(editPickReply)) {
      await sendPickDropList(messageFrom, "pick");
    }
    if (JSON.stringify(message?.interactive?.button_reply) === JSON.stringify(editDropReply)) {
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
    const buttonsEditPickType = [
      {type: "reply", reply: editPickReply},
      {type: "reply", reply: dropReply},
    ];

    const buttonsEditDropType = [
      {type: "reply", reply: pickReply},
      {type: "reply", reply: editDropReply},
    ];

    const buttonsEditPickDropType = [
      {type: "reply", reply: editPickReply},
      {type: "reply", reply: editDropReply},
    ];

    const buttonsPickDropType = [
      {type: "reply", reply: pickReply},
      {type: "reply", reply: dropReply},
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
        const editBody = `You already both pickup (${filteredPick[0].data.time}) 
          & drop (${filteredDrop[0].data.time}) route. Edit it?`;
        await sendChoice(messageFrom, editHeader, editBody, buttonsEditPickDropType);
      } else if (hasPickType) {
        const editBody = `You already have a pickup (${filteredPick[0].data.time}) route. Edit it?`;
        await sendChoice(messageFrom, editHeader, editBody, buttonsEditPickType);
      } else {
        const editBody = `You already have a drop(${filteredDrop[0].data.time}) route. Edit it?`;
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
