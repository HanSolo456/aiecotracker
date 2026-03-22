const requestId = "70c914ae377d41b7a3843f0b19f6bdf1";
console.log("Checking api...");
fetch("http://localhost:3000/api/desktop-auth/google?requestId=" + requestId)
  .then(r => r.json())
  .then(j => console.log(j))
  .catch(console.error);
