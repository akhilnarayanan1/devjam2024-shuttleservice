import type {Timestamp} from "firebase-admin/firestore";
import type {DateTime} from "luxon";

interface RequestStore {
    id: string;
    data: {
        type: PickDropRequest;
        routemap: string;
        time: string;
        timeindia: DateTime;
        pending: boolean;
        expired: boolean;
        createdAt: Timestamp;
        updatedAt: Timestamp;
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
