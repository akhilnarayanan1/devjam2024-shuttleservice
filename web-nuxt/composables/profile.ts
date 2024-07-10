import type { FirestoreUserProfile } from "@/assets/js/types";

export const profile = () => useState<FirestoreUserProfile>(
    "profile", () => ({
        createdOn: "",
        name: "",
        sesaid: "",
        phoneno: 0,
    })
);

export const getProfile = () => computed(()=>profile()).value;

export const setProfile = (data: FirestoreUserProfile) => {
    profile().value.createdOn = data.createdOn;
    profile().value.name = data.name;
    profile().value.sesaid = data.sesaid;
    profile().value.phoneno = data.phoneno;
};