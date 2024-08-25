import {DateTime} from "luxon";
import type {LocationStore, Request, PickDropRequest, RequestStore, Location,
  GetRequestsUser, GetRequestsAll, WALocation} from "./types";
import axios from "axios";
import * as admin from "firebase-admin";
import {FieldValue, Timestamp} from "firebase-admin/firestore";
import * as _ from "lodash";
import {MESSAGES_URL, PICK_SECTION, DROP_SECTION, ROUTE_PICK, ROUTE_DROP, TIMEZONE,
  BUTTON_EDIT_PICK, BUTTON_EDIT_DROP, BUTTON_EDIT_PICK_DROP, BUTTON_PICK_DROP} from "./constants";
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
  sections: {title: string, rows: {id: string, title: string}[]}[]): PickDropRequest | undefined => {
  for (const section of sections) {
    const foundRow = section.rows.find((row) => row.id === input.id && row.title === input.title);
    if (foundRow) {
      return section.title as PickDropRequest;
    }
  }
  return undefined;
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

const sendMessageWithUrl = async (onlySend: RequestStore[], messageFrom: string, url: string) => {
  console.log("Only send", onlySend);
  const totalOnlySend = onlySend.length;

  onlySend.forEach(async (request) => {
    let urlMessage = `Shared the location, view live ${url} here. \n\n` +
      `Total number of people onboarding: ${totalOnlySend}`;

    if (request.data.for === messageFrom) {
      urlMessage = "Thanks for sharing the location. \n" +
        "Live location has been sent to all the members. \n" +
        `Total number of people onboarding: ${totalOnlySend}`;
    }
    await normalMessage(request.data.for, urlMessage);
  });
};

const calculateTodayNowJS = (time?: string) => {
  let userDateNowIndia; // Declare userDateNowIndia here
  if (time) {
    ({userDateNowIndia} = convertUserTime(time));
    return userDateNowIndia;
  } else {
    return DateTime.now().setZone(TIMEZONE);
  }
};

const getLocation = async (routekey: string) => {
  const locations = await admin.firestore().collection("locations").where("routekey", "==", routekey).get();
  return locations.docs[0].data()?.coordinates;
};

const processTextMessage = async (messageBody: string, messageFor: string, time?: string) => {
  const todayNowJS = calculateTodayNowJS(time);
  const todayStart = todayNowJS.set({hour: 0, minute: 0, second: 0, millisecond: 0});
  const todayEnd = todayNowJS.plus({days: 1}).set({hour: 0, minute: 0, second: 0, millisecond: 0});

  const allUserRequests = await getUserRequest({todayStart, todayEnd, messageFor});
  const allRequests = await getAllRequests({todayStart, todayEnd});
  const onlyLatestForUser = _.head(_.filter(allUserRequests, (request: RequestStore) => {
    return (todayNowJS <= DateTime.fromJSDate(request.data.timeindia.toDate()));
  }));

  const {gotMatch, url} = getMapsUrl(messageBody);

  if (gotMatch) {
    if (!onlyLatestForUser) {
      await normalMessage(messageFor, "No request found for you, either its expired or not created");
      return;
    }

    const onlySend = _.filter(allRequests, ["data.time", onlyLatestForUser.data.time]);

    await sendMessageWithUrl(onlySend, messageFor, url);
    return;
  }

  if (allUserRequests.length > 0) {
    const hasPickType = _.some(allUserRequests, ["data.type", "pick"]);
    const hasDropType = _.some(allUserRequests, ["data.type", "drop"]);
    const filteredPick = _.filter(allUserRequests, ["data.type", "pick"]);
    const filteredDrop = _.filter(allUserRequests, ["data.type", "drop"]);

    const editHeader = "Edit/New Route Type";

    if (hasPickType && hasDropType) {
      const editBody = `You already both pickup at (${filteredPick[0].data.time}) 
        & drop at (${filteredDrop[0].data.time}). Edit it?`;
      await sendChoice(messageFor, editHeader, editBody, BUTTON_EDIT_PICK_DROP);
    } else if (hasPickType) {
      const editBody = `You already have a pickup at (${filteredPick[0].data.time}). Edit it?`;
      await sendChoice(messageFor, editHeader, editBody, BUTTON_EDIT_PICK);
    } else {
      const editBody = `You already have a drop at(${filteredDrop[0].data.time}). Edit it?`;
      await sendChoice(messageFor, editHeader, editBody, BUTTON_EDIT_DROP);
    }
    return;
  }

  const editBody = "Please select the route type";
  await sendChoice(messageFor, "Pick Route Type", editBody, BUTTON_PICK_DROP);
};

const acceptLocation = async (messageFor: string, currentWALocation: WALocation, time?: string) => {
  const todayNowJS = calculateTodayNowJS(time);
  const todayStart = todayNowJS.set({hour: 0, minute: 0, second: 0, millisecond: 0});
  const todayEnd = todayNowJS.plus({days: 1}).set({hour: 0, minute: 0, second: 0, millisecond: 0});

  const allUserRequests = await getUserRequest({todayStart, todayEnd, messageFor});
  const onlyLatestForUser = _.head(_.filter(allUserRequests, (request: RequestStore) => {
    return (todayNowJS <= DateTime.fromJSDate(request.data.timeindia.toDate()));
  }));

  if (currentWALocation?.name || currentWALocation?.address) {
    await normalMessage(messageFor, "I need live location, not address or name");
    return;
  }

  if (!onlyLatestForUser) {
    await normalMessage(messageFor, "No request found for you, either its expired or not created");
    return;
  }

  const pickOrDrop = onlyLatestForUser?.data.type as PickDropRequest;
  let locationDetails = {} as {latitude: number, longitude: number};

  if (pickOrDrop === "pick") {
    locationDetails = await getLocation("metro");
  }

  if (pickOrDrop === "drop") {
    locationDetails = await getLocation("argon");
  }

  const totalDistance = Math.abs(getDistanceFromLatLonInKm(locationDetails, currentWALocation));
  console.log("Total distance", totalDistance);

  if (totalDistance > 1) {
    await normalMessage(messageFor, "You are far from the pickup point, come closer");
    return;
  }
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

const sendLocationRequest = async (messageFor: string, messageBody: string) => {
  await axios({
    method: "POST",
    url: MESSAGES_URL,
    headers: {Authorization: `Bearer ${GRAPH_API_TOKEN}`},
    data: {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      type: "interactive",
      to: messageFor,
      interactive: {
        type: "location_request_message",
        body: {
          "text": messageBody,
        },
        action: {
          "name": "send_location",
        },
      },
    },
  });
};

const markRead = async (messageId: string) => {
  // mark incoming message as read
  await axios({
    method: "POST",
    url: MESSAGES_URL,
    headers: {Authorization: `Bearer ${GRAPH_API_TOKEN}`},
    data: {
      messaging_product: "whatsapp",
      status: "read",
      message_id: messageId,
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


const putRequest = async (requestType: PickDropRequest | undefined, user: string, time: string) => {
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

  if (requestType === undefined) {
    await normalMessage(user, "Invalid route type");
    return {routeMessage, mapsUrl};
  }

  if (requestType === "pick") {
    routeMessage = createRouteMessage(locations, ROUTE_PICK, time);
    mapsUrl += createMapsUrl(locations, ROUTE_PICK);
  }
  if (requestType === "drop") {
    routeMessage = createRouteMessage(locations, ROUTE_DROP, time);
    mapsUrl += createMapsUrl(locations, ROUTE_DROP);
  }

  const payload: Request = {
    type: requestType,
    routemap: mapsUrl,
    for: user,
    time: time,
    createdAt: FieldValue.serverTimestamp() as Timestamp,
    timeindia: Timestamp.fromDate(userDateNowIndia.toJSDate()) as Timestamp,
    expired: false,
    updatedAt: FieldValue.serverTimestamp() as Timestamp,
  };

  const request = await getUserRequest({todayStart, todayEnd, messageFor: user});
  if (_.some(request, ["data.type", requestType]) ) {
    const docid = _.filter(request, ["data.type", requestType])[0].id;
    await admin.firestore().collection("requests").doc(docid).update({...payload});
  } else {
    await admin.firestore().collection("requests").add({...payload, createdAt: FieldValue.serverTimestamp()});
  }

  return {routeMessage, mapsUrl};
};

const getDistanceFromLatLonInKm = (
  from: {latitude: number, longitude: number},
  to: {latitude: number, longitude: number}
) => {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(to.latitude-from.latitude); // deg2rad below
  const dLon = deg2rad(to.longitude-from.longitude);
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(from.latitude)) * Math.cos(deg2rad(to.latitude)) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const d = R * c; // Distance in km
  return d;
};

const deg2rad = (deg: number) => {
  return deg * (Math.PI/180);
};

export {findTitleInSections, sendPickDropList, putRequest, sendReminder, setExpiredRequests,
  sendCTAUrl, convertUserTime, processTextMessage, acceptLocation, markRead, calculateTodayNowJS,
  normalMessage, isTimeValid, sendLocationRequest};
