import { redirect } from "next/navigation";

/** The users list is the admin's home; this is just a shorter URL for it. */
export default function AdminPage() {
  redirect("/admin/users");
}
