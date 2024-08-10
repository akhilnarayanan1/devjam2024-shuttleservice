import type {Timestamp} from "firebase-admin/firestore";
import type {DateTime} from "luxon";

interface Request {
    type: PickDropRequest;
    routemap: string;
    time: string;
    for: string;
    timeindia: Timestamp;
    expired: boolean;
    createdAt: Timestamp;
    updatedAt: Timestamp;
}

interface RequestStore {
    id: string;
    data: Request;
}

interface Location {
    shortname: string;
    placename: string;
    placeid: string;
    routekey: string;
    coordinates: {
        lat: number;
        lng: number;
    };
}

interface LocationStore {
    id: string;
    place: Location;
}

interface GetRequestsAll {
    todayStart: DateTime;
    todayEnd: DateTime;
}

interface GetRequestsUser extends GetRequestsAll {
    messageFor: string;
}

interface WALocation {
    latitude: number;
    longitude: number;
    address?: string;
    name?: string;
}

type PickDropRequest = "pick" | "drop";

export {RequestStore, Request, LocationStore, Location, PickDropRequest, GetRequestsUser, GetRequestsAll, WALocation};
