import type {Timestamp} from "firebase-admin/firestore";

interface RequestStore {
    id: string;
    data: {
        type: PickDropRequest;
        routemap: string;
        time: string;
        pending: boolean;
        createdAt: Timestamp;
    }
}

interface Location {
    shortname: string;
    placename: string;
    placeid: string;
    routekey: string;
}

interface LocationStore {
    id: string;
    place: Location;
}

type PickDropRequest = "pick" | "drop";


export {RequestStore, LocationStore, Location, PickDropRequest};
