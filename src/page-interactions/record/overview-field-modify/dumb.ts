const interaction: PageInteraction = {
  action: 'overview-field-modify',
  enabled: true,
  name: 'PS-Template Modify Overview Fields',
  page: 'record',
  sortOrder: 0,
  script: (API: PageInteractionAPI, field: NovoOverviewField) => {
    console.log('LOGGING', field);
  },
};

export default interaction;
