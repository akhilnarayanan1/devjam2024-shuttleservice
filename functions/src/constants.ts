import * as express from "express";

const {GRAPH_API_VERSION, BUSINESS_WA_NO} = process.env;

const MESSAGES_URL = `https://graph.facebook.com/${GRAPH_API_VERSION}/${BUSINESS_WA_NO}/messages`;

const TIMEZONE = "Asia/Kolkata";

const PICK_REPLY = {id: "1", title: "Pick"};
const DROP_REPLY = {id: "2", title: "Drop"};
const EDIT_PICK_REPLY = {id: "3", title: "Edit Pick"};
const EDIT_DROP_REPLY = {id: "4", title: "Edit Drop"};

const ROUTE_PICK = ["metro", "neon", "xenon", "argon"];
const ROUTE_DROP = ["xenon", "neon", "argon", "metro"];
const DEMO_ROUTE_HOME = ["home", "argon"];
const DEMO_ROUTE_OFFICE = ["argon", "metro"];

const PICK_SECTION = {
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

const DROP_SECTION = {
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

const ALL_SECTIONS = [PICK_SECTION, DROP_SECTION];

const app = express();
app.use(express.json());

export {ALL_SECTIONS, PICK_REPLY, DROP_REPLY, EDIT_PICK_REPLY, EDIT_DROP_REPLY, MESSAGES_URL,
  PICK_SECTION, DROP_SECTION, ROUTE_PICK, ROUTE_DROP, DEMO_ROUTE_HOME, DEMO_ROUTE_OFFICE, TIMEZONE, app};
