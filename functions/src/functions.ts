import {DateTime} from "luxon";
import type {LocationStore, PickDropRequest, RequestStore, Location} from "./types";
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

const setExpiredRequests = async () => {
  const todayNow = DateTime.now().setZone(TIMEZONE).toJSDate();
  const batch = admin.firestore().batch();
  await admin.firestore().collection("request")
    .where("expired", "==", false)
    .where("timeindia", "<", Timestamp.fromDate(todayNow)).get()
    .then((snapshot) => snapshot.forEach((doc) => batch.update(doc.ref, {
      pending: false,
      expired: true,
      updatedAt: FieldValue.serverTimestamp(),
    })));
  batch.commit();
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


const populateRequest = async (messageFrom: string) => {
  const requests: RequestStore[] = [];
  await admin.firestore().collection("request")
    .where("for", "==", messageFrom)
    .where("pending", "==", true)
    .where("expired", "==", false)
    .get().then((querySnapshot) => {
      querySnapshot.forEach((doc) => {
        requests.push({id: doc.id, data: doc.data()} as RequestStore);
      });
    });
  return requests;
};


const putRequest = async (requestType: PickDropRequest, user: string, time: string) => {
  const locations: LocationStore[] = [];
  const {userDateNowIndia} = convertUserTime(time);
  await admin.firestore().collection("locations").get().then((querySnapshot) => {
    querySnapshot.forEach((doc) => locations.push({id: doc.id, place: doc.data() as Location}));
  });

  let mapsUrl = "";

  if (requestType === "pick") {
    mapsUrl += createMapsUrl(locations, ROUTE_PICK);
  }
  if (requestType === "drop") {
    mapsUrl += createMapsUrl(locations, ROUTE_DROP);
  }

  const payload = {
    type: requestType,
    routemap: mapsUrl,
    for: user,
    time: time,
    timeindia: userDateNowIndia.toJSDate(),
    pending: true,
    expired: false,
    updatedAt: FieldValue.serverTimestamp(),
  };

  const request = await populateRequest(user);
  console.log(payload, request, requestType, _.some(request, ["data.type", requestType]));
  if (_.some(request, ["data.type", requestType]) ) {
    const docid = _.filter(request, ["data.type", requestType])[0].id;
    await admin.firestore().collection("request").doc(docid).update(payload);
  } else {
    await admin.firestore().collection("request").add({...payload, createdAt: FieldValue.serverTimestamp()});
  }
};

export {isTimeValid, createMapsUrl, findTitleInSections, convertUserTime,
  sendChoice, normalMessage, sendPickDropList, populateRequest, putRequest, setExpiredRequests};
