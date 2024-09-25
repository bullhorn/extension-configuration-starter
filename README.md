# Extension Configuration Starter

> Starter Kit used to generate a Bullhorn Extension configuration

## Usage

1. Clone this repository
2. Run `npm install` once
3. Update
   - `description` and `repository` properties in `package.json`
   - `name` property in `extension.json`
   - `name` property in `selective-extension.json`
4. Replace the files inside `src` with your own
   - Field Interactions should live in `src/field-interactions/{entity-name}/{field-name}/*`
     * e.g. `src/field-interactions/candidate/custom-text-1/my-interactions.ts`
   - Page Interactions should live in `src/page-interactions/record/{page-interaction-type}/*`
     * e.g. `src/page-interactions/add-edit-presave/my-interaction.ts`
   - You can check the `/extension.json` file to confirm the specific directories/patterns used to retrieve files
5.  Populate your environment files
    - You can add arbitrary application parameters to these files, which will be injected into all extracted interactions
      * e.g. `"admin.usertype.id": "12,13,14"` will replace any occurences of `${admin.usertype.id}` with `12,13,14` 
      * Because of string interpolation in ES6, be sure to only use single quotes when injecting variables...`'`, not ``` ` ```
      * e.g. adminUserTypeId: '${admin.usertype.id}'
    - By default there is one environment file for prod and one for staging, with corresponding npm jobs
      * The `deploy` job uses `environment.prod.json`, `deploy:staging` uses `environment.staging.json`
      * More environments can be added by adding new environment files and new npm jobs in `package.json`.
    - Configure your users that will be used to deploy your interactions
      * you can provide an array of `users`
        - each user object should have a `username`, `password`, and `privateLabelId` parameter
        - Running the corresponding job deploys all Field and Page Interactions to every users' Private Label in the file
        - In order to handle uniqueness within the Bullhorn database, the script will
          * Only deploy Page Interactions for the first user in the array
          * Change the name of the extension being deployed to include the privateLabelId 
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
6. In case you want eslint rules to fix a specific file for you then run `eslint --fix ${relative_path}`.
  * e.g. `eslint --fix src/field-interactions/candidate/custom-text-1/my-interactions.ts`

7. Set up the script deploy script
    * To set up the script add the lines to the scripts section in your package.json
    ```
    "selective-deploy:<env name>": "node bin/selective-build-and-upload.js <env name> selective",
    "full-deploy:<env name>": "node bin/full-build-and-upload.js <env name> selective"
    ```
    * make sure the env name match the names given in your environment files
8. Rules for use
  * each interaction has a unique combo to help the script identify them that is written in the interaction
    ```
    * for field interactions its the entity in the extensions with fieldName + name
    * for custom objects its the custom-object-instance in the extensions with fieldName + name
    * for page interactions is action + name
    ```
    * this mean if you create an interactions where these elements are the same it won’t be able to deploy them correctly
      * For example two interactions with the name read-only for customText1 in candidate will cause a conflict

9. How To Use deploy script 
    * There are two kinds of deploy Selective Deploy and Full Deploy
  - Selective Deploy
    * This deployment is a targeted deploy of selected interactions
    * you deploy field interactions, page interactions and custom object interactions here
    * For this deploy you need to copy the selective-extension.json from the bin folder and copy it to the root of the project (same level as bin) here you will see a template on how to write these files
    * for each section you need to follow the format. You can delete the fieldInteractions/ customObjectsFieldInteractions / pageInteractions objects if you don’t wish to deploy any
    ```
    {
      "name": "<client name>-interactions",
      "fieldInteractions": {
        "Candidate": {
            "fields": [
                {
                    "fieldName": "customText4",
                    "fieldInteractionNames": [
                        "format-manpower-agent_CDC-63",
                        "set-readonly_CDC-4765"
                    ]
                }
            ]
        },
        "ClientCorporation": {
            "fields": [
                {
                    "fieldName": "status",
                    "fieldInteractionNames": [
                        "disable-fields_CDL-9_CDC-1463_CDC-7_CDC-57"
                    ]
                }
            ]
        }
      },
      "customObjectsFieldInteractions": {
        "person-custom-object-5": {
            "fields": [
                {
                    "fieldName": "date1",
                    "fieldInteractionNames": [
                        "age-to-work_CDC-1334"
                    ]
                }
            ]
        }
      },
      "pageInteractions": {
        "action-modify": [
            "hide-action-dropdown"
        ],
        "overview-field-modify": [
            "disable-all-candidate-fields_CDC-3971"
        ]
      }
    }
    ```
    * field interactions
      * in field interactions you need to have the entities as they appear in the extension file with a list of field objects containing field names and list of the names of the interactions 
    * custom object interactions
      * very similar to field interactions you need to list the custom object instances as they appear in the extension file with a list of fields objects containing the field name and list of interaction names you wish to deploy
    * page interactions
      * for page interactions you simply need to use actions as keys with the list of interaction names you wish to deploy. Like before if the page interaction is not included in the extension file it will fail to be deployed
      * once you have set up your selective-extension.json in the root of your project with the interactions you wish to deploy all you need to do is run the selective-deploy:<env> script to deploy
  - Full Deploy
    * The full deploy will try to add or update every interaction in your local repository
    * The full deploy is rather simple you so long as you have set up the configs and extension file you just need to run full-deploy:<env> 
    * its advised you do this on a shell for large project as the results screen can be rather large
      * **note** this will not delete any interactions that is planned feature
      * **note** note error 2 means there is syntax error in one of your interaction

