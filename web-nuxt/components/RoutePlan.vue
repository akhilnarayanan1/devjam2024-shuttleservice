<template>
     <div class="flex justify-center mx-4">
            <div class="card shadow max-w-sm m-4">
                <div class="flex justify-center items-center mt-4">
                    <div class="card-title">Route Planner</div>
                </div>
                <div class="card-body">
                    <form id="formTripPlanner" @submit.prevent="startTrip">
                        <div class="label"><span class="label-text-alt">Shuttle:</span></div>
                        <select v-model="route" class="select select-bordered w-full max-w-xs">
                            <option disabled selected>Pick a shuttle</option>
                            <option v-for="shuttle in _.orderBy(shuttles, ['type', 'orderid'], ['desc', 'asc'])" :key="shuttle.time" :value="shuttle">
                                {{ shuttle.type }} - {{ shuttle.time }}
                            </option>
                        </select>
                        
                        <div class="label"><span class="label-text-alt">From:</span></div>
                        <select v-model="from" class="select select-bordered w-full max-w-xs">
                            <option disabled selected>Pick a location</option>
                            <option v-for="location in locations" :key="location.id" :value="location">{{ location.place.shortname }}</option>
                        </select>

                        <div class="flex justify-center items-center mt-4">
                            <button type="button" class="btn btn-ghost btn-sm" @click="swapLocations">
                                <span class="material-symbols-outlined">swap_vert</span>
                                <span>SWAP</span>
                                <span class="material-symbols-outlined">swap_vert</span>
                            </button>
                        </div>

                        <div class="label"><span class="label-text-alt">To:</span></div>
                        <select v-model="to" class="select select-bordered w-full max-w-xs">
                            <option disabled selected>Pick a location</option>
                            <option v-for="location in locations" :key="location.id" :value="location">{{ location.place.shortname }}</option>
                        </select>

                        <button type="submit" class="btn btn-block glass bg-primary hover:bg-primary text-white mt-4">
                            <span v-if="loading.form_route_plan" class="loading loading-spinner loading-sm"></span>
                            <span>START TRIP</span>
                        </button>
                    </form>
                </div>
            </div> 
        </div>
</template>


<script setup lang="ts">
    import { collection, query, getDocs, addDoc, serverTimestamp } from "firebase/firestore";
    import type { ToastData, WhatsAppCTAMessage, Location, LocationStore, Shuttle, Route } from "~/assets/js/types";
    import _ from "lodash";

    const loading = reactive({ form_route_plan: false });
    const db = useFirestore();

    
    const shuttles = reactive<Array<Shuttle>>([]);
    const route = ref<Shuttle>({} as Shuttle);

    const locations = reactive<Array<LocationStore>>([]);
    const from = ref<LocationStore>({} as LocationStore);
    const to = ref<LocationStore>({} as LocationStore);

    const querySnapshotLocations = await getDocs(query(collection(db, "locations")));
    querySnapshotLocations.forEach((doc) => {  
        locations.push({id: doc.id, place: {...doc.data()} as Location});
    });

    const querySnapshotShuttles = await getDocs(query(collection(db, "shuttles")));
    querySnapshotShuttles.forEach((doc) => {  
        shuttles.push({...doc.data()} as Shuttle);
    });

    watch(route, (newVal) => {
        if (newVal.type === "pick") {
            from.value = locations.find(location => location.place.routekey === "metro") as LocationStore;
            to.value = locations.find(location => location.place.routekey === "office") as LocationStore;
        } else {
            from.value = locations.find(location => location.place.routekey === "office") as LocationStore;
            to.value = locations.find(location => location.place.routekey === "metro") as LocationStore;
        }
    });

    // keys present in filter will be removed from the query parsing
    const objectToQueryString = (obj: Record<string, any>, filterKeys: Array<string>): string => {
    const filteredObj = Object.fromEntries(
        Object.entries(obj).filter(([key]) => !filterKeys.includes(key))
    );

    return Object.entries(filteredObj)
        .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
        .join('&');
    };
    

    const startTrip = async () => {
        if (from.value.id == to.value.id) {
            addToast({
                message: "From and To locations cannot be the same",
                type: "error",
                duration: 3000,
            })
            return;
        }
        if (!from.value.id || !to.value.id) {
            addToast({
                message: "Please select both From and To locations",
                type: "error",
                duration: 3000,
            })
            return;
        }

        loading.form_route_plan = true;

        await addDoc(collection(db, "routes"), {
            from: from.value,
            to: to.value,
            createdOn: serverTimestamp(),
        } as Route);
        
        const config = useRuntimeConfig()
        const { GRAPH_API_VERSION, BUSINESS_WA_NO, GRAPH_API_TOKEN } = config.public;

        const API_URL = `https://graph.facebook.com/${GRAPH_API_VERSION}/${BUSINESS_WA_NO}/messages`;
        const body = {
            origin:  from.value.place.placename,
            originPlaceId: from.value.place.placeid,
            destination: to.value.place.placename,
            destinationPlaceId: to.value.place.placeid,
            originShortName: from.value.place.shortname,
            destinationShortName: to.value.place.shortname,
            travelmode: "driving",
        }

        if (body["origin"] === "" || body["destination"] === "" ||
            body["originPlaceId"] === "" || body["destinationPlaceId"] === "" ||
            body["originShortName"] === "" || body["destinationShortName"] === "") {
            addToast({
                message: "Missing required fields",
                type: "error",
                duration: 3000,
            } as ToastData)
            return;
        }
        const query_parsed = objectToQueryString(body, ["originShortName", "destinationShortName"]);

        const {data: waResponse, status, error} = await useFetch(API_URL, {
                server: true,
                method: "POST",
                headers: {
                    Authorization: `Bearer ${GRAPH_API_TOKEN}`
                },
                body: {
                    "messaging_product": "whatsapp",
                    "recipient_type": "individual",
                    "to": "917987089820",
                    "type": "interactive",
                    "interactive": {
                    "type": "cta_url",
                    /* Body optional */
                    "body": {
                        "text": `🚀 Route plan 🚀\n\n📍*${body.originShortName}* ➡️ 📍*${body.destinationShortName}*\n\nLet's go! 🚗💨`,
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
        });

        loading.form_route_plan = false;

        if (status.value === "error") {
            addToast({
                message: JSON.stringify(error.value?.data),
                type: "error",
                duration: 3000,
            } as ToastData)
            return;
        }

        addToast({
            message: JSON.stringify(waResponse.value),
            type: "success",
            duration: 3000,
        } as ToastData)
        
    };
    
    // swap values inside from and to
    const swapLocations = () => [from.value, to.value] = [to.value, from.value];
</script>