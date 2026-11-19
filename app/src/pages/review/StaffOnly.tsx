import { Link } from "react-router-dom";
import { Empty } from "../../components/ui";
import { backendEnabled, useSession } from "../../lib/backend";

/**
 * Shown on the review console to anyone who is not staff. With the backend on,
 * staff access comes from the signed-in account's role (reviewer or admin);
 * without it, the local console is turned on per device from Settings.
 */
export function StaffOnly() {
  return backendEnabled ? <ServerStaffOnly /> : <LocalStaffOnly />;
}

function ServerStaffOnly() {
  const { session } = useSession();
  return (
    <div className="page">
      <Empty title="Staff only">
        {session ? (
          <>
            You are signed in{session.email ? ` as ${session.email}` : ""}, which is not a reviewer account. <Link to="/account">Sign in with a reviewer account</Link> to open
            the review console.
          </>
        ) : (
          <>
            The review console is for the review team. <Link to="/account">Sign in with a reviewer account</Link> to see the orders assigned to you.
          </>
        )}
      </Empty>
    </div>
  );
}

function LocalStaffOnly() {
  return (
    <div className="page">
      <Empty title="Staff only">
        The review console is for the review team. Open <Link to="/settings?staff=1">/settings?staff=1</Link> and turn on staff mode on the founder's device.
      </Empty>
    </div>
  );
}
