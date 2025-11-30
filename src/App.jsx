import { useEffect } from "react";
import { useDispatch } from "react-redux";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./util/firebase";
import { login, logout } from "./util/userSlice";
import Body from "./components/Body";

import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const App = () => {
  const dispatch = useDispatch();

  useEffect(() => {
    // Check authentication state on app load
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        // User is authenticated, dispatch login action
        const { uid, email, displayName } = user;
        dispatch(login({ uid: uid, email: email, name: displayName }));
      } else {
        // User is not authenticated, dispatch logout action
        dispatch(logout());
      }
    });

    // Cleanup subscription on component unmount
    return () => unsubscribe();
  }, [dispatch]);

  return (
    <div>
      <Body />
      <ToastContainer position="bottom-right" theme="dark" />
    </div>
  );
};

export default App;
