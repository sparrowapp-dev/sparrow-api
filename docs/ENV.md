# Points to remember

1. You need to have a proper SMTP server to enble mailing capabilities in Sparrow. If you are a contributor and do no to have a SMTP server then set the below env to false

   `SMTP_ENABLED=false`

In case you set the above env to 'false', you wont be able to get verification code to create new users, reset password or any other in-app emails. You can use the following default email/password combination to login to Sparrow:

    Email - dev@sparrow.com <br />
    Password - 12345678@

2. There are multiple ways to setup Mongo. You need to change the below env variables accordingly,

   `DB_URL`

   - If you used the provided scripts to run the API server and Mongo inside Docker containers, use:

     `DB_URL=mongodb://sparowapp:sparrow123@mongo:27017`

   - If Mongo is running directly on your machine or on a different host:

     `DB_URL=mongodb://[USERNAME]:[PASSWORD]@[HOST]:[PORT]`