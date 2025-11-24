declare type ToastThemes = 'default' | 'success' | 'info' | 'warning' | 'danger' | 'positive' | string;
declare type ToastIcons = 'bell' | 'check' | 'info' | 'warning' | 'remove' | 'caution' | 'times' | 'coffee' | 'danger' | string;
declare type ToastPositions = 'fixedTop' | 'fixedBottom' | 'growlTopRight' | 'growlTopLeft' | 'growlBottomRight' | 'growlBottomLeft';

interface ToastOptions {
  title?: string;
  message?: string;
  action?: string;
  icon?: ToastIcons;
  theme?: ToastThemes;
  accent?: ToastThemes;
  hideDelay?: number;
  position?: ToastPositions;
  isCloseable?: boolean;
  customClass?: string;
}

interface PageInteraction {
  action: 'tab-modify' | 'action-modify' | 'overview-field-modify' | 'workflow-modify' | 'activity-section-modify' | 'workflow-section-modify' | 'add-edit-presave' | 'add-edit-postsave' | 'list-post-load' | 'column-link-validation';
  enabled?: boolean;
  name: string;
  page: 'record' | 'list';
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
  className: string;
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
  pageDK: any;
  currentEntity: string;
  currentEntityId: string;
  currentEntityTrack: string;
  subEntity: string;
  pageContext: string;
  http: any;
  toastService: any;
  modalService: any;
  injectCustomStyles(styleID: string, styles: string): void;
  promptUser(params: {
    headerText: string;
    subheaderText: string
  }): Promise<boolean>;
  displayToast(toastConfig: ToastOptions): void;
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

interface FieldInteractionEvent {
  controlKey: string;
  prop: string;
  value: any;
}

interface FieldInteractionAPI {
  form: any;
  appBridge: any;
  toaster: any;
  modalService: any;
  formUtils: any;
  http: any;
  labels: any;
  associations: { [ key: string ]: any };
  readonly currentEntity: string;
  readonly currentEntityId: string;
  readonly isEdit: boolean;
  readonly isAdd: boolean;
  globals: FieldInteractionGlobals;
  currentKey: string;
  isInvokedOnInit: boolean;
  isActiveControlValid(): boolean;
  getActiveControl(): any;
  getActiveKey(): string;
  getActiveValue(): any;
  getActiveInitialValue(): any;
  getFieldSet(key: string, otherForm?: any): any;
  getControl(key: string, otherForm?: any): any;
  getFormGroupArray(key: string, otherForm?: any): any[];
  getValue(key: string, otherForm?: any): any;
  getRawValue(key: string, otherForm?: any): any;
  getInitialValue(key: string, otherForm?: any): any;
  setValue(key: string, value: any, options?: {
    onlySelf?: boolean;
    emitEvent?: boolean;
    emitModelToViewChange?: boolean;
    emitViewToModelChange?: boolean;
  }, otherForm?: any): void;
  patchValue(key: string, value: any, options?: {
    onlySelf?: boolean;
    emitEvent?: boolean;
    emitModelToViewChange?: boolean;
    emitViewToModelChange?: boolean;
  }, otherForm?: any): void;
  setReadOnly(key: string, isReadOnly: boolean, otherForm?: any): void;
  setRequired(key: string, required: boolean, otherForm?: any): void;
  setDescription(key: string, description: string, otherForm?: any): void;
  highlight(key: string, isHighlighted: boolean, otherForm?: any): void;
  hide(key: string, clearValue?: boolean, otherForm?: any): void;
  show(key: string, otherForm?: any): void;
  hideFieldSetHeader(key: string): void;
  showFieldSetHeader(key: string): void;
  disable(key: string, options?: {
    onlySelf?: boolean;
    emitEvent?: boolean;
  }, otherForm?: any): void;
  enable(key: string, options?: {
    onlySelf?: boolean;
    emitEvent?: boolean;
  }, otherForm?: any): void;
  markAsInvalid(key: string, validationMessage?: string, otherForm?: any): void;
  markAsValid(key: string, otherForm?: any): void;
  markAsDirty(key: string, options?: {
    onlySelf?: boolean;
  }, otherForm?: any): void;
  markAsPending(key: string, options?: {
    onlySelf?: boolean;
  }, otherForm?: any): void;
  markAsPristine(key: string, options?: {
    onlySelf?: boolean;
  }, otherForm?: any): void;
  markAsTouched(key: string, options?: {
    onlySelf?: boolean;
  }, otherForm?: any): void;
  markAsUntouched(key: string, options?: {
    onlySelf?: boolean;
  }, otherForm?: any): void;
  updateValueAndValidity(key: string, options?: {
    onlySelf?: boolean;
    emitEvent?: boolean;
  }, otherForm?: any): void;
  displayToast(toastConfig: ToastOptions): void;
  displayTip(key: string, tip: string, icon?: string, allowDismiss?: boolean, sanitize?: boolean, otherForm?: any): void;
  clearTip(key: string, otherForm?: any): void;
  setTooltip(key: string, tooltip: string, otherForm?: any): void;
  setPopOver(key: string, popover: {
    title?: string,
    content?: string,
    htmlContent?: string,
    placement?: 'left' | 'right' | 'top' | 'bottom',
    onHover?: boolean,
    always?: boolean,
    disabled?: boolean,
    animation?: boolean,
    dismissTimeout?: number,
  }, otherForm?: any): void;
  confirmChanges(key: string, message?: string): Promise<boolean>;
  promptUser(key: string, changes: string[]): Promise<boolean>;
  setProperty(key: string, prop: string, value: any, otherForm?: any): void;
  getProperty(key: string, prop: string, otherForm?: any): any;
  isValueEmpty(key: string): boolean;
  isValueBlank(key: string): boolean;
  hasField(key: string, otherForm?: any): boolean;
  addStaticOption(key: string, newOption: any, otherForm?: any): void;
  removeStaticOption(key: string, optionToRemove: string, otherForm?: any): void;
  modifyPickerConfig(key: string, config: {
    format?: string;
    minSearchLength?: number;
    enableInfiniteScroll?: boolean;
    optionsUrl?: string;
    optionsUrlBuilder?: Function;
    optionsPromise?: any;
    options?: any[];
    resultsTemplateType?: 'entity-picker';
  }, mapper?: Function): void;
  mutatePickerConfig(key: string, options: any, mapper?: Function, otherForm?: any): any;
  addPropertiesToPickerConfig(key: string, properties: { [key: string]: unknown }, otherForm?: any): void;
  setLoading(key: string, loading: boolean, otherForm?: any): void;
  addControl(key: string, metaForNewField: any, position?: string, initialValue?: any, otherForm?: any): void;
  removeControl(key: string, otherForm?: any): void;
  debounce(func: () => void, wait?: number): void;
  getParent(otherForm?: any): any;
  getIndex(otherForm?: any): any;
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
  userTypeName: string;
  departmentName: string;
  userPrimaryDepartmentId: number;
}

interface IdName {
  id: number;
  name: string;
}
