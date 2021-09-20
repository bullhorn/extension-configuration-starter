const interaction: FieldInteraction = {
  fieldName: 'name',
  name: 'PS-Template Log Me!',
  event: 'init',
  sortOrder: 1,
  invokeOnInit: true,
  script: (API: FieldInteractionAPI) => {
    console.log('LOGGING', API.globals);
  },
};

export default interaction;
