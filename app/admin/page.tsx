import { redirect } from "next/navigation";

import { ADMIN_HOME_PATH } from "@/lib/home-path";

/** Just a shorter URL for the admin's home. */
export default function AdminPage() {
  redirect(ADMIN_HOME_PATH);
}
