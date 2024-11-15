const interaction: FieldInteraction = {
  fieldName: 'text1',
  name: 'PCO3_text1_example',
  event: 'change',
  sortOrder: 1,
  invokeOnInit: false,
  script: (API: FieldInteractionAPI) => {
    console.log('LOGGING', API.globals);
  },
};

export default interaction;
