import { Link, Navigate, useLocation, useParams } from "react-router-dom";
import { usePublicSchool } from "@/hooks/usePublicSchool";
import { publicClassPath } from "@/lib/publicSchool";

/** Keep existing shared /book links, but land in the unified class experience. */
export default function LegacyClassLink() {
  const { classId } = useParams();
  const { search, hash } = useLocation();
  const { data, isPending, isError, refetch } = usePublicSchool();
  const item = data?.classes.find(cls => cls.id === classId);
  if (isPending) return <div className="tde-directory"><p role="status">Finding your class…</p></div>;
  if (isError) return <div className="tde-directory"><p>Your class couldn’t load.</p><button className="tde-button" onClick={() => void refetch()}>Try again</button></div>;
  if (!item) return <div className="tde-directory"><h1>Class unavailable</h1><Link to="/classes">Explore current classes</Link></div>;
  return <Navigate to={`${publicClassPath(item)}${search}${hash}`} replace />;
}
