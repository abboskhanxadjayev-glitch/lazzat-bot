import { Navigate } from "react-router-dom";
import { useCourierSession } from "../hooks/useCourierSession";

function CourierPage() {
  const { isAuthenticated } = useCourierSession();

  return <Navigate replace to={isAuthenticated ? "/courier-dashboard" : "/courier-login"} />;
}

export default CourierPage;
