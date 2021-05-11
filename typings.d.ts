interface PageInteraction {
  action: 'tab-modify' | 'action-modify' | 'overview-field-modify' | 'workflow-modify' | 'activity-section-modify' | 'workflow-section-modify' | 'add-edit-presave' | 'add-edit-postsave';
  enabled?: boolean;
  name: string;
  page: 'record';
  script: Function;
  sortOrder: number;
}

interface NovoRecordTab {
  path: string;
  label: string;
  entities: string[];
  countKey?: string;
  canDisable: boolean;
  sortOrder: number;
  permissions?: any;
  hidden?: boolean;
  disabled?: boolean;
  style?: any;
}

interface NovoOverviewField {
  name: string;
  type: string;
  dataType: string;
  maxLength?: number;
  dataSpecialization: string;
  confidential: boolean;
  optional: boolean;
  label: string;
  hidden: boolean;
  required: boolean;
  readOnly: boolean;
  multiValue: boolean;
  inputType?: string;
  options?: [{ value: string, label: string }];
  optionsType: string;
  hideFromSearch: boolean;
  sortOrder: number;
  associatedEntity: any;
}

interface PageInteractionAPI {
  globals: {
    settings: any;
    entitlements: any;
    user: any;
  };
  appBridge: any;
  currentEntity: string;
  currentEntityId: string;
  currentEntityTrack: string;
  pageContext: string;
  http: any;
  toastService: any;
  modalService: any;
  injectCustomStyles(styleID: string, styles: string): void;
  promptUser(params: {
    headerText: string;
    subheaderText: string
  }): Promise<boolean>;
  displayToast(toastConfig: {
    message: string;
    title?: string;
    hideDelay?: number;
    icon?: string;
    theme?: string;
    position?: string;
    isCloseable?: boolean;
    customClass?: string
  }): void;
}

interface FieldInteraction {
  fieldName: string;
  name: string;
  enabled?: boolean;
  event: 'change' | 'focus' | 'blur' | 'init';
  invokeOnInit: boolean;
  sortOrder: number;
  script: Function;
  privateLabelIds?: Array<string>;
}

interface FieldInteractionAPI {
  form: any;
  readonly currentEntity: string;
  readonly currentEntityId: string;
  readonly isEdit: boolean;
  readonly isAdd: boolean;
  globals: FieldInteractionGlobals;
  currentKey: string;
  appBridge: any;
  isActiveControlValid(): boolean;
  getActiveKey(): string;
  getActiveValue(): any;
  getActiveInitialValue(): any;
  getControl(key: string): any;
  getValue(key: string): any;
  getRawValue(key: string): any;
  getInitialValue(key: string): any;
  setValue(key: string, value: any, options?: {
    onlySelf?: boolean;
    emitEvent?: boolean;
    emitModelToViewChange?: boolean;
    emitViewToModelChange?: boolean;
  }): void;
  patchValue(key: string, value: any, options?: {
    onlySelf?: boolean;
    emitEvent?: boolean;
    emitModelToViewChange?: boolean;
    emitViewToModelChange?: boolean;
  }): void;
  setReadOnly(key: string, isReadOnly: boolean): void;
  setRequired(key: string, required: boolean): void;
  hide(key: string, clearValue?: boolean): void;
  show(key: string): void;
  disable(key: string, options?: {
    onlySelf?: boolean;
    emitEvent?: boolean;
  }): void;
  enable(key: string, options?: {
    onlySelf?: boolean;
    emitEvent?: boolean;
  }): void;
  markAsInvalid(key: string, validationMessage?: string): void;
  markAsDirty(key: string, options?: {
    onlySelf?: boolean;
  }): void;
  markAsPending(key: string, options?: {
    onlySelf?: boolean;
  }): void;
  markAsPristine(key: string, options?: {
    onlySelf?: boolean;
  }): void;
  markAsTouched(key: string, options?: {
    onlySelf?: boolean;
  }): void;
  markAsUntouched(key: string, options?: {
    onlySelf?: boolean;
  }): void;
  updateValueAndValidity(key: string, options?: {
    onlySelf?: boolean;
    emitEvent?: boolean;
  }): void;
  displayToast(toastConfig: {
    message: string;
    title?: string;
    hideDelay?: number;
    icon?: string;
    theme?: string;
    position?: string;
    isCloseable?: boolean;
    customClass?: string;
  }): void;
  displayTip(key: string, tip: string, icon?: string, allowDismiss?: boolean): void;
  confirmChanges(key: string, message?: string): Promise<boolean>;
  promptUser(key: string, changes: string[]): Promise<boolean>;
  setProperty(key: string, prop: string, value: any): void;
  getProperty(key: string, prop: string): any;
  isValueEmpty(key: string): boolean;
  isValueBlank(key: string): boolean;
  hasField(key: string): boolean;
  addStaticOption(key: string, newOption: any): void;
  removeStaticOption(key: string, optionToRemove: string): void;
  modifyPickerConfig(key: string, config: {
    format?: string;
    optionsUrl?: string;
    optionsUrlBuilder?: Function;
    optionsPromise?: any;
    options?: any[];
  }, mapper?: Function): void;
  setLoading(key: string, loading: boolean): void;
  addControl(key: string, metaForNewField: any, position?: string, initialValue?: any): void;
  removeControl(key: string): void;
  debounce(func: () => void, wait?: number): void;
}

interface FieldInteractionGlobals {
  entitlements: any;
  settings: FieldInteractionSettings;
  user: FieldInteractionUser;
}

interface FieldInteractionSettings {
  allDeptIds: Array<number>;
  allPrivateLabelIds: Array<IdName>;
  corporationId: number;
  corporationName: string;
  privateLabelId: IdName;
  userDepartments: Array<IdName>;
}

interface FieldInteractionUser {
  allPrivateLabelIds: Array<number>;
  corporationId: number;
  corporationName: string;
  dataCenterId: number;
  email: string;
  firstName: string;
  isSReleaseULEnabled: boolean;
  lastName: string;
  locale: string;
  masterUserId: number;
  name: string;
  privateLabelId: number;
  userId: number;
  userTypeId: number;
  username: string;
}

interface IdName {
  id: number;
  name: string;
}
