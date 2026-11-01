// Personal details on the Me page (types shared by server and client). "" = not filled in.

export interface Profile {
  fullName: string;
  nickname: string;
  phone: string;
  email: string;
  lineId: string;
  birthday: string; // YYYY-MM-DD
  allergies: string;
  emergencyName: string;
  emergencyPhone: string;
}

export const EMPTY_PROFILE: Profile = {
  fullName: "",
  nickname: "",
  phone: "",
  email: "",
  lineId: "",
  birthday: "",
  allergies: "",
  emergencyName: "",
  emergencyPhone: "",
};

/** Profile photo served through the signed-in file route (same outlet only). */
export const avatarUrl = (key: string | null) => (key ? `/api/files/${key}` : null);
