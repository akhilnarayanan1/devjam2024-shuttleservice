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

const {WEBHOOK_VERIFY_TOKEN, GRAPH_API_TOKEN,
  GRAPH_API_VERSION, BUSINESS_WA_NO, ONE_DRIVER} = process.env;

const app = express();
app.use(express.json());

const MESSAGES_URL = `https://graph.facebook.com/${GRAPH_API_VERSION}/${BUSINESS_WA_NO}/messages`;

app.post("/send-message-to-driver", async (req: Request, res: Response) => {
  const {origin, destination, originPlaceId, destinationPlaceId} = req.body;

  if (origin === undefined || destination === undefined ||
    originPlaceId === "" || destinationPlaceId === "") {
    res.status(422).send("Necessary parameters not present");
  }

  const queryParsed = new URLSearchParams({
    origin, destination, originPlaceId, destinationPlaceId,
  }).toString();

  await axios({
    method: "POST",
    url: MESSAGES_URL,
    headers: {Authorization: `Bearer ${GRAPH_API_TOKEN}`},
    data: {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: ONE_DRIVER,
      type: "interactive",
      interactive: {
        type: "cta_url",
        body: {
          text: `🚀 Route plan 🚀\n\n📍*${origin}* ➡️` +
          `📍*${destination}*\n\nLet's go! 🚗💨 \n\n`,
        },
        action: {
          name: "cta_url",
          parameters: {
            display_text: "OPEN MAPS",
            url: `https://www.google.com/maps/dir/?api=1&${queryParsed}`,
          },
        },
      },
    },
  });

  res.sendStatus(200);
});


app.post("/webhook", async (req: Request, res: Response) => {
  // check if the webhook request contains a message
  // details on WhatsApp text message payload: https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/payload-examples#text-messages
  const message = req.body.entry?.[0]?.changes[0]?.value?.messages?.[0];

  // check if the incoming message contains text
  if (message?.type === "text") {
    // send a reply message as per the docs here https://developers.facebook.com/docs/whatsapp/cloud-api/reference/messages
    await axios({
      method: "POST",
      url: MESSAGES_URL,
      headers: {Authorization: `Bearer ${GRAPH_API_TOKEN}`},
      data: {
        messaging_product: "whatsapp",
        to: "917987089820", // change this
        text: {body: message.text.body},
      },
    });

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
