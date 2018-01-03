const interaction: PageInteraction = {
  action: 'overview-field-modify',
  enabled: true,
  name: 'PS-Adecco Modify Overview Fields',
  page: 'record',
  sortOrder: 0,
  script: (API: PageInteractionAPI, field: NovoOverviewField, data: any) => {
    console.log('LOGGING', API.globals);
    field.hidden = true;
    return field;
  },
};

export default interaction;
