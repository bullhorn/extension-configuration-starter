# Slack Tutorial

This tutorial demonstrates using Cloud Functions to recieve data events from Bullhorn and send them to slack

### Costs

   This tutorial uses billable components of Cloud Platform

### Google Cloud Functions

1. Before you begin Select or create a GCP project.
   
   [GO TO THE MANAGE RESOURCES PAGE](https://console.cloud.google.com/cloud-resource-manager)

2. Make sure that billing is enabled for your project.

   [LEARN HOW TO ENABLE BILLING](https://cloud.google.com/billing/docs/how-to/modify-project)

3. Enable the Cloud Functions APIS

   [Install and initialize the Cloud SDK](https://cloud.google.com/sdk/docs/)

4. Update and install gcloud components:

   ```gcloud components update && gcloud components install beta```

### Setup 

#### Setup Slack Webhook

1.  Create a new Slack app: "YOUR_APP_NAME Deploy"
    https://api.slack.com/apps?new_app=1

2.  Add 'Incoming Webhook' and Activate it. Then click 'Add New Webhook to Workspace'
    and pick the channel you want to post to. Copy the webhook URL to use in step 4.

#### Preparing the function

1. Move into the directory:

   ```cd ./functions/gcf-slack ```

2. Modify the config.json file in the gcf_slack directory and replace [YOUR_SLACK_WEBHOOK_URL] 
   with the webhook url provided by Slack in the Basic information page of your app configuration.


#### Deploying the function

   To deploy the function with an HTTP trigger, run the following command in the gcf_slack directory:

   ```$ gcloud beta functions deploy sendToSlack --trigger-http```

#### Testing the function

   ```
   $ curl -X POST 'https://[YOUR_REGION]-[YOUR_PROJECT_ID].cloudfunctions.net/sendToSlack?entity=Test&status=Success&candidate=JohnSmith&job=Developer&startDate=Tomorrow'
   ```

### Deploying your Bots

1. Modify the `./placement/slack-placement.ts` and replace [YOUR_REGION]-[YOUR_PROJECT_ID] with Clooud Function variables

2. Add your Bots to `extensions.json`

   ```
   "bots": [
     "./dist/bots/placement/slack-placement.js",
   ], ...
   ```

3. Extract and Upload you extension

   ```
   $ npm run deploy 
   ```

### CleanUp

```
gcloud beta functions delete sendToSlack
bullhorn uninstall [YOUR_EXTENSION_NAME]
```
