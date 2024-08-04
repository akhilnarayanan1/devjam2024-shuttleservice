import {DateTime} from "luxon";
import type {LocationStore, PickDropRequest, RequestStore, Location, GetRequestsUser, GetRequestsAll} from "./types";
import axios from "axios";
import * as admin from "firebase-admin";
import {FieldValue, Timestamp} from "firebase-admin/firestore";
import * as _ from "lodash";
import {MESSAGES_URL, PICK_SECTION, DROP_SECTION, ROUTE_PICK, ROUTE_DROP, TIMEZONE} from "./constants";

const {GRAPH_API_TOKEN} = process.env;

const isTimeValid = (timeString: string) => {
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
  const originPlaceId = originVal.place.placeid;

  const destination = encodeURIComponent(destinationVal.place.placename);
  const destinationPlaceId = destinationVal.place.placeid;

  const waypoints = route.slice(1, -1).reduce((joinedString, waypoint) => {
    const waypointVal = locations.find((location) => location.place?.routekey === waypoint) as LocationStore;
    return joinedString ? `${encodeURIComponent(joinedString+"|"+waypointVal.place.placename)}` :
      encodeURIComponent(waypointVal.place.placename);
  }, "");

  const waypointPlaceIds = route.slice(1, -1).reduce((joinedString, waypoint) => {
    const waypointVal = locations.find((location) => location.place?.routekey === waypoint) as LocationStore;
    return joinedString ? `${encodeURIComponent(joinedString+"|"+waypointVal.place.placeid)}` :
      encodeURIComponent(waypointVal.place.placeid);
  }, "");

  const mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${origin}&`+
      `origin_place_id=${originPlaceId}&destination=${destination}&`+
      `destination_place_id=${destinationPlaceId}&waypoints=${waypoints}&`+
      `waypoint_place_ids=${waypointPlaceIds}&travelmode=driving&dir_action=navigate`;

  return mapsUrl;
};

const createRouteMessage = (locations: LocationStore[], route: string[], time: string) => {
  const originVal = locations.find((location) => location.place?.routekey === route.at(0)) as LocationStore;
  const destinationVal = locations.find((location) => location.place?.routekey === route.at(-1)) as LocationStore;

  const origin = originVal.place.shortname;
  const destination = destinationVal.place.shortname;

  const message = `Scheduled for ${time}.\n\n\n` +
  "*Be the 'LEADER':* The first person to share their live location will be the 'LEADER'.\n\n" +
  "*Real-time updates:* Everyone can track the LEADER's trip progress.\n\n" +
  "*Smooth pickup:* Share your location when you're close to the pickup point.\n\n" +
  "_How to Share Live-Location?🤔_\n\n" +
  "*Will send a reminder again few minutes before the trip.*\n\n" +
  `📍*Pickup* - *${origin}*\n\n📍*Drop* - *${destination}*\n\nLet's go! 🚗💨`;

  return message;
};

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
  const todayNowIndia = DateTime.now().setZone(TIMEZONE);
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

const getUserRequest = async (args: GetRequestsUser) => {
  const requests: RequestStore[] = [];
  const {todayStart, todayEnd, messageFor} = args;

  const todayStartTimestamp = Timestamp.fromDate(todayStart.toJSDate());
  const todayEndTimestamp = Timestamp.fromDate(todayEnd.toJSDate());

  await admin.firestore().collection("requests")
    .where("expired", "==", false)
    .where("timeindia", ">=", todayStartTimestamp)
    .where("timeindia", "<", todayEndTimestamp)
    .where("for", "==", messageFor)
    .orderBy("timeindia", "asc")
    .get().then((querySnapshot) => {
      querySnapshot.forEach((doc) => requests.push({id: doc.id, data: doc.data()} as RequestStore));
    });

  return requests;
};

const getAllRequests = async (args: GetRequestsAll) => {
  const requests: RequestStore[] = [];
  const {todayStart, todayEnd} = args;

  const todayStartTimestamp = Timestamp.fromDate(todayStart.toJSDate());
  const todayEndTimestamp = Timestamp.fromDate(todayEnd.toJSDate());

  await admin.firestore().collection("requests")
    .where("expired", "==", false)
    .where("timeindia", ">=", todayStartTimestamp)
    .where("timeindia", "<", todayEndTimestamp)
    .orderBy("timeindia", "asc")
    .get().then((querySnapshot) => {
      querySnapshot.forEach((doc) => requests.push({id: doc.id, data: doc.data()} as RequestStore));
    });

  return requests;
};

const setExpiredRequests = async (todayNow: DateTime) => {
  const batch = admin.firestore().batch();
  await admin.firestore().collection("requests")
    .where("expired", "==", false)
    .where("timeindia", "<", Timestamp.fromDate(todayNow.toJSDate()))
    .get().then((snapshot) => snapshot.forEach((doc) => batch.update(doc.ref, {
      expired: true,
      updatedAt: FieldValue.serverTimestamp(),
    })));
  batch.commit();
};

const getMapsUrl = (text: string) => {
  // Regular expression to capture the URL
  const urlRegex = /(https?:\/\/maps\.app\.goo\.gl\/.*)/;

  // Extract the URL
  const match = urlRegex.exec(text);
  let gotMatch = false;
  let url = "";

  if (match) {
    url = match[1]; // Capture group 1 contains the URL
    gotMatch = true;
  }
  return {gotMatch, url};
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

const sendCTAUrl = async (
  messageFrom: string,
  headerText: string,
  messageText: string,
  displayText: string,
  mapsUrl: string) => {
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
        type: "cta_url",
        header: {type: "text", text: headerText},
        body: {text: messageText},
        action: {
          name: "cta_url",
          parameters: {display_text: displayText, url: mapsUrl},
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


const sendPickDropList = async (messageFrom: string, routeType: PickDropRequest) => {
  let messageText = "";
  let actionButtonText = "";
  let section = {};
  if (routeType === "pick") {
    messageText = "📍*Pickup* - Seetharam Palaya Metro\n\n📍*Drop* - Schneider - Argon North\n\n🚗💨";
    section = PICK_SECTION;
    actionButtonText = "Pickup timings";
  }
  if (routeType === "drop") {
    messageText = "📍*Pickup* - Schneider - Argon North\n\n📍*Drop* - Seetharam Palaya Metro \n\n🚗💨";
    section = DROP_SECTION;
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

const sendReminder = async (time: DateTime) => {
  const reminders: RequestStore[] = [];
  const currentTime = Timestamp.fromDate(time.toJSDate());
  const currentTimeWithOffset = Timestamp.fromDate(time.plus({minutes: 10}).toJSDate());

  await admin.firestore().collection("requests")
    .where("expired", "==", false)
    .where("timeindia", ">", currentTime)
    .where("timeindia", "<=", currentTimeWithOffset)
    .orderBy("timeindia", "asc")
    .get().then((querySnapshot) => {
      querySnapshot.forEach((doc) => reminders.push({id: doc.id, data: doc.data()} as RequestStore));
    });

  const groupedReminders = Object.entries(_.groupBy(reminders, "data.time"));
  const sendReminders = _.head(_.orderBy(groupedReminders, ([key]) => convertUserTime(key).userDateNowIndia));

  const totalReminders = sendReminders ? sendReminders[1].length : 0;

  if (sendReminders) {
    sendReminders[1].forEach(async (reminder) => {
      await normalMessage(reminder.data.for,
        `Reminder: Your *${reminder.data.type == "pick" ? "pickup": "drop" }* ` +
        `route at *${reminder.data.time}* is about to start. \n` +
        `Total number of people onboarding: ${totalReminders}`);
    });
  }
};


const putRequest = async (requestType: PickDropRequest, user: string, time: string) => {
  const locations: LocationStore[] = [];
  const {userDateNowIndia} = convertUserTime(time);

  const todayNowJS = DateTime.now().setZone(TIMEZONE);
  const todayStart = todayNowJS.set({hour: 0, minute: 0, second: 0, millisecond: 0});
  const todayEnd = todayNowJS.plus({days: 1}).set({hour: 0, minute: 0, second: 0, millisecond: 0});

  await admin.firestore().collection("locations").get().then((querySnapshot) => {
    querySnapshot.forEach((doc) => locations.push({id: doc.id, place: doc.data() as Location}));
  });

  let mapsUrl = "";
  let routeMessage = "";

  if (requestType === "pick") {
    routeMessage = createRouteMessage(locations, ROUTE_PICK, time);
    mapsUrl += createMapsUrl(locations, ROUTE_PICK);
  }
  if (requestType === "drop") {
    routeMessage = createRouteMessage(locations, ROUTE_DROP, time);
    mapsUrl += createMapsUrl(locations, ROUTE_DROP);
  }

  const payload = {
    type: requestType,
    routemap: mapsUrl,
    for: user,
    time: time,
    timeindia: userDateNowIndia.toJSDate(),
    expired: false,
    updatedAt: FieldValue.serverTimestamp(),
  };

  const request = await getUserRequest({todayStart, todayEnd, messageFor: user});
  if (_.some(request, ["data.type", requestType]) ) {
    const docid = _.filter(request, ["data.type", requestType])[0].id;
    await admin.firestore().collection("requests").doc(docid).update(payload);
  } else {
    await admin.firestore().collection("requests").add({...payload, createdAt: FieldValue.serverTimestamp()});
  }

  return {routeMessage, mapsUrl};
};

export {isTimeValid, createMapsUrl, findTitleInSections, convertUserTime, sendChoice, getMapsUrl, getAllRequests,
  normalMessage, sendPickDropList, putRequest, setExpiredRequests, sendCTAUrl, getUserRequest, sendReminder};
