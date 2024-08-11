import type {Request, Response} from "express";
import {GeoPoint} from "firebase-admin/firestore";
import * as admin from "firebase-admin";
import {putRequest, convertUserTime, setExpiredRequests, sendReminder,
  processTextMessage, acceptLocation} from "./functions";

export const populateLocations = async (req: Request, res: Response) => {
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
};

export const populateRequest = async (req: Request, res: Response) => {
  await putRequest("pick", "91aaaaaaaaaa", "09:30 AM");
  await putRequest("pick", "91bbbbbbbbbb", "09:30 AM");
  await putRequest("drop", "91aaaaaaaaaa", "04:30 PM");
  await putRequest("drop", "91aaaaaaaaaa", "07:30 PM");
  res.sendStatus(200);
};

export const fakeScheduler = async (req: Request, res: Response) => {
  const time = req.params.time as string;

  const {userDateNowIndia} = convertUserTime(time);

  console.log("Fake trigger", userDateNowIndia);

  await setExpiredRequests(userDateNowIndia);
  await sendReminder(userDateNowIndia);

  res.sendStatus(200);
};

export const fakeSendUrl = async (req: Request, res: Response) => {
  const messageFor = req.params.messageFor as string;
  const time = req.params.time as string;

  console.log("Fake trigger URL", messageFor, time);

  const messageBody1 = "I'm on my way. See my trip progress and arrival time " +
    "on Maps: https://maps.app.goo.gl/7FMyKW9SWJ7JiWEkq";

  // const messageBody2 = "Hi";

  await processTextMessage(messageBody1, messageFor, time);

  res.sendStatus(200);
};

export const validateLocation = async (req: Request, res: Response) => {
  const messageFor = req.params.messageFor as string;
  const time = req.params.time as string;

  const currentWALocation = {
    latitude: 12.969051361084,
    longitude: 77.733055114746,
  };

  console.log("Fake trigger URL", currentWALocation, messageFor, time);

  await acceptLocation(messageFor, currentWALocation, time);

  res.sendStatus(200);
};
