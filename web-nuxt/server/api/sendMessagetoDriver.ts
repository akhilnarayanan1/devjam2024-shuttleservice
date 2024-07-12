const objectToQueryString = (obj: Record<string, any>): string => {
    return Object.entries(obj)
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join('&');
}

export default defineEventHandler(async (event) => {
    const query = getQuery(event);
    const { GRAPH_API_VERSION, GRAPH_API_TOKEN, BUSINESS_WA_NO, ONE_DRIVER } = useRuntimeConfig(event);
    const API_URL = `https://graph.facebook.com/${GRAPH_API_VERSION}/${BUSINESS_WA_NO}/messages`

    const query_parsed = objectToQueryString(query)

    const repo = await $fetch(API_URL, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${GRAPH_API_TOKEN}`
        },
        body: {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": ONE_DRIVER.toString(),
            "type": "interactive",
            "interactive": {
              "type": "cta_url",
              /* Body optional */
              "body": {
                "text": `🚀 Route plan 🚀\n\n📍*${query.origin}* ➡️ 📍*${query.destination}*\n\nLet's go! 🚗💨`,
              },
              "action": {
                "name": "cta_url",
                "parameters": {
                  "display_text": "OPEN MAPS",
                  "url": `https://www.google.com/maps/dir/?api=1&${query_parsed}`
                }
              }
            }
          }
    })

    return repo;
});
  