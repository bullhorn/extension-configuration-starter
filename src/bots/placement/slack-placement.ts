const slackPlacement: Bot = {
  name: 'Placement Approved',
  botType: 'POSTSAVE',
  isEnabled: true,
  onUpdate: true,
  entity: 'Placement',
  botConditionData: {
    botConditions: [
      {
        entity: 'Placement',
        field: 'status',
        matchOperator: 'EQUALS',
        value: 'Approved',
      },
    ],
    logicOperator: 'AND',
  },
  botOutcomes: [
    {
      outcomeType: 'WEBHOOK',
      // url: 'https://[YOUR_REGION]-[YOUR_PROJECT_ID].cloudfunctions.net/sendToSlack',
      url: 'https://us-central1-engage-shifts.cloudfunctions.net/sendToSlack',
      httpMethod: 'POST',
      queryParams: {
        entity: 'Placement',
        entityId: '$id',
        status: '$status',
        candidate: '$candidate.name',
        job: '$jobOrder.title',
        startDate: '$startDate',
      },
    },
  ],
};

export default slackPlacement;
