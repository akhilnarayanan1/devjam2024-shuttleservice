import { type Timestamp } from "firebase-admin/firestore";

interface AlertData{
  message: string,
  type: 'error' | 'success'| 'warning',
  source: 'ui' | 'server'
  fieldid: string,
};

interface ToastData{
  id?: number,
  message: string,
  run?: {
    feature: () => void,
    message: string,
  },
  type: 'error' | 'success'| 'warning',
  duration?: number,
};

interface RandomKeyValue { 
  [key: string]: string;
}

interface FirestoreUserProfile{
  createdOn: Timestamp, 
  name: string, 
  phoneno: number,
  admin: boolean,
};

interface MessageDetails {
  message: string,
  from: string,
  to: string,
  createdOn: Timestamp,
  fakename: string,
  fakeimage: string,
};

interface WhatsAppCTAMessage {
  messaging_product: string,
  contacts: { input: string, wa_id: string }[],
  messages: { id: string }[],
};


interface Location { 
  shortname: string,
  placename: string,
  placeid: string,
  routekey?: "office" | "metro",
};

interface LocationStore {
  id: string;
  place: Location
};

interface ShuttleDetails{
  orderid: string, 
  type: "pick" | "drop", 
  time: string
};

interface Shuttle extends ShuttleDetails {
  number: number;
};

interface Route {
  from: LocationStore;
  to: LocationStore;
  createdOn: Timestamp;
};

export type {
  AlertData,
  ToastData,
  RandomKeyValue,
  FirestoreUserProfile,
  MessageDetails,
  WhatsAppCTAMessage,
  Location,
  LocationStore,
  Shuttle,
  ShuttleDetails,
  Route,
};