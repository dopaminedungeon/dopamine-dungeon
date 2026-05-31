import { auth } from "./firebase/firebase";

export async function testApiMe() {
  const user = auth.currentUser;

  if (!user) {
    console.log("No Firebase user is currently signed in.");
    return;
  }

  const token = await user.getIdToken();

  const response = await fetch("http://localhost:3000/api/me", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json();
  console.log("API /me response:", data);
  return data;
}

window.testApiMe = testApiMe;