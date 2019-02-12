# Extension Configuration Starter

> Starter Kit used to generate a Bullhorn Extension configuration

## Usage

1. Fork this repository
2. Update `name` property in `extension.json`
3. Replace the files inside `src` with your own
   - Field Interactions should live in `src/field-interactions/{entity-name}/{field-name}/*`
     * e.g. `src/field-interactions/candidate/custom-text-1/my-interactions.ts`
   - Page Interactions should live in `src/page-interactions/record/{page-interaction-type}/*`
     * e.g. `src/page-interactions/add-edit-presave/my-interaction.ts`
   - You can check the `/extension.json` file to confirm the specific directories/patterns used to retrieve files
4.  Populate your environment files
    - You can add arbitrary application parameters to these files, which will be injected into all extracted interactions
      * e.g. `"admin.usertype.id": "12,13,14"` will replace any occurences of `${admin.usertype.id}` with `12,13,14` 
      * Because of string interpolation in ES6, be sure to only use single quotes when injecting variables...`'`, not ``` ` ```
    - By default there is one environment file for prod and one for staging, with corresponding npm jobs
      * The `deploy` job uses environment.prod.json, `deploy:staging` uses environment.staging.json
      * More environments can be added by adding new environment files and new npm jobs in `package.json`.  Copy an existing npm job and change the final parameter to the name of your environment
      * e.g. making a job
        ```
          "deploy:qa": "node bin/build-and-upload.js qa"
        ```
        will expect a file `environment.qa.json` to exist in the `environments` folder
    - There are two options for configuring an environment file
      * you can provide a `username` and `password` parameter.  Running the corresponding job will deploy all interactions to the Private Label for the user provided in `username` (Note: Page Interactions are Corporation specific, so they get deployed to every Private Label always)
        - e.g. 
        ```json
          {
            "username": "my.username",
            "password": "myPassword123"
          }
        ```
      * you can provide an array of `users`
        - each user object should have a `username`, `password`, and `privateLabelId` parameter
        - Running the corresponding job deploys all Field and Page Interactions to every users' Private Label in the file
        - In order to handle uniqueness within the Bullhorn database, the script will
          * Only deploy Page Interactions for the first user in the array
          * Change the name of the extension being deployed to include the privateLabelId as part of the compilation process
          * e.g. this file will deploy all interactions for both Private Labels 22 and 33.  If the `extension.json` `name` parameter has a value of `myclient-interactions`, Private Label 22 will get an extension with name `myclient-22-interactions`, etc. 
            ```json
              {
                "users": [
                  {
                    "username": "my.username.1",
                    "password": "myPassword123",
                    "privateLabelId": "22"
                  },
                  {
                    "username": "my.username.2",
                    "password": "myPassword123",
                    "privateLabelId": "33"
                  }
                ] 
              }
            ```
