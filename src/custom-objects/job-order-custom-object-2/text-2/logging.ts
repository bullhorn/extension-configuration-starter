const interaction: FieldInteraction = {
  fieldName: 'text2',
  name: 'JCO2_text2_example',
  event: 'init',
  sortOrder: 1,
  invokeOnInit: true,
  script: (API: FieldInteractionAPI) => {
    console.log('Init test', API);
  },
};

export default interaction;
