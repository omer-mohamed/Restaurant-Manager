
Dependencies :
-mongodb
-express
-express-session

-type npm init to get the dependencies and to install type npm install and the dependencies name
-run the mongo dameon by typing mongod in a different terminal
-in a different terminal type in mongo to get to the database
-run the server by typing in node server.js

Decisions:
-The pug files use 2 different headers depending on if the user is logged in or not
-The order is stored with the specific user in an array with a unique order ID
-Each user is stored by lowercasing their username so its easier for the query
-Users are shown iwth either their privacy set to false or the query defined
