import { Link } from "react-router-dom";
import { Empty } from "../../components/ui";
import { SignIn } from "../../components/SignIn";
import { backendEnabled, isMock, signOut, useSession } from "../../lib/backend";
import { ENGLISH_ONLY } from "./serverShared";
import "./review.css";

export interface StaffOnlyProps {
  /** "staff": reviewer or admin (review console); "admin": admin only (/admin) */
  need?: "staff" | "admin";
}

/**
 * Shown to anyone who is not staff. With the backend on, access comes from
 * the signed-in account's role (reviewer or admin) and the reviewer signs in
 * right here: SignIn's email link returns to the current URL (/review,
 * /review/orders/:id or /admin), and a session from the code or the link
 * makes the gate re-check the role in place. Without the backend, the local
 * console is turned on per device from Settings.
 */
export function StaffOnly({ need = "staff" }: StaffOnlyProps) {
  return backendEnabled ? <ServerStaffOnly need={need} /> : <LocalStaffOnly />;
}

function ServerStaffOnly({ need }: { need: "staff" | "admin" }) {
  const { session } = useSession();
  const what = need === "admin" ? "the operator dashboard" : "the review console";
  const kind = need === "admin" ? "an admin account" : "a reviewer account";
  if (session)
    return (
      <div className="page rv-staff" {...ENGLISH_ONLY}>
        <Empty title={need === "admin" ? "Admin accounts only" : "Staff only"}>
          {`You are signed in${session.email ? ` as ${session.email}` : ""}, which is not ${kind}.`}{" "}
          <button type="button" className="rv-link" onClick={() => void signOut()}>
            Sign out
          </button>{" "}
          {`and sign in with ${kind} to open ${what}.`}
        </Empty>
      </div>
    );
  return (
    <div className="page rv-staff" {...ENGLISH_ONLY}>
      <div className="rv-signin">
        <SignIn
          title={need === "admin" ? "Operator sign-in" : "Reviewer sign-in"}
          lead={
            need === "admin"
              ? "Admin accounts only. We email you a sign-in code; you come back to this page."
              : "For the review team. We email you a sign-in code; you come back to this page once you are signed in."
          }
        />
        {isMock && (
          <p className="rv-foot">
            {need === "admin"
              ? 'Demo mode: use an email that starts with "admin" (for example admin@example.com) and any 6 digits.'
              : 'Demo mode: use an email that starts with "reviewer" or "admin" (for example reviewer@example.com) and any 6 digits.'}
          </p>
        )}
      </div>
    </div>
  );
}

function LocalStaffOnly() {
  return (
    <div className="page rv-staff" {...ENGLISH_ONLY}>
      <Empty title="Staff only">
        The review console is for the review team. Open <Link to="/settings?staff=1">/settings?staff=1</Link> and turn on staff mode on the founder's device.
      </Empty>
    </div>
  );
}
