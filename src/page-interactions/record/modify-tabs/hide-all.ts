const interaction: PageInteraction = {
  action: 'tab-modify',
  enabled: true,
  name: 'PS-Adecco Modify Tabs',
  page: 'record',
  sortOrder: 0,
  script: (API: PageInteractionAPI, item: NovoRecordTab) => {
    console.log('LOGGING', API.globals);
    item.hidden = true;
    return item;
  },
};

export default interaction;
