import { Link } from "react-router-dom";
import { Empty } from "../../components/ui";

export function StaffOnly() {
  return (
    <div className="page">
      <Empty title="Staff only">
        The review console is for the review team. <Link to="/settings">Turn on staff mode in Settings</Link> on the founder's device.
      </Empty>
    </div>
  );
}
