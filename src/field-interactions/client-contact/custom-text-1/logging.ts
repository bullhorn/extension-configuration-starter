const interaction: FieldInteraction = {
  fieldName: 'customText1',
  name: 'PS-Adecco Custom Logger',
  event: 'change',
  sortOrder: 1,
  invokeOnInit: false,
  script: (API: FieldInteractionAPI) => {
    console.log('LOGGING', API.globals);
  },
};

export default interaction;
