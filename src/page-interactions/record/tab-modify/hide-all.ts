const interaction: PageInteraction = {
  action: 'tab-modify',
  enabled: true,
  name: 'PS-Template Modify Tabs',
  page: 'record',
  sortOrder: 0,
  script: (API: PageInteractionAPI, item: NovoRecordTab) => {
    console.log('LOGGING', item);
  },
};

export default interaction;
