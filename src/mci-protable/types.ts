import type { ProColumns, ProFormInstance, ProTableProps } from '@ant-design/pro-components';
import { ButtonProps } from 'antd';
import type { RulesLogic } from 'json-logic-js';

export interface ILogicItem<QueryServiceEntity extends Record<string, any> = Record<string, any>> {
  /** 匿名函数字符串, 如传入将优先使用该配置 */
  functionString?: string;
  /** 作用域: search=搜索表单, createForm=新建表单, editForm=编辑表单。 默认['createForm', 'editForm'] */
  formTypes?: Array<'search' | 'createForm' | 'editForm'>;
  /** 依赖字段 */
  dependencies: string[];
  /** 要更新对象：columns formItemProps fieldProps */
  logicFor: keyof MciProColumns<QueryServiceEntity>;
  /** 逻辑配置 */
  logic?: RulesLogic;
  /** 条件成立时字段 */
  truthy?: any;
  /** 条件不成立时 */
  falsy?: any;
}

export type MciInternalActionType = 'edit' | 'view' | 'remove';

export interface IMciProActionFull {
  key: MciInternalActionType | string;
  name: string | React.ReactNode;
  onClick?: (record: any, ctx?: IProviderCtxProps) => void;

  disabled?: boolean;

  /** 自定义渲染  */
  nameRenderer?: string;

  nameRendererProps?: Record<string, any>;

  popOver?: {
    title?: string;
    description: string;
    cancelText?: string;
    confirmText?: string;
  };
}

export type TMciProAction = MciInternalActionType | IMciProActionFull;

export interface MciInternalValueObject {
  type: 'JSFunction' | 'JSExpression';
  value: string;
}

// TODO: 这里虽然定义的是表格的列配置接口，但实际上也透传到了 createForm，editForm, viewForm 中
//     实际上这个配置是透传到了 pro-form, pro-descriptions 中
//     类型不一定完美能够兼容，后期可能想要一些区分可能不太方便 (比如desc的需要一些field订制)
//     不过刚好有的字段是匹配的 如 formItemProps
export interface MciProColumns<QueryServiceEntity extends Record<string, any> = Record<string, any>>
  extends ProColumns<QueryServiceEntity> {
  /** 操作栏的操作动作的配置 */
  actions?: TMciProAction[];
  logics?: ILogicItem<QueryServiceEntity>[];
  /** 是否不在新建表单中展示：默认展示，true隐藏 */
  hideInCreateForm?: boolean;
  /** 是否不在编辑表单中展示：默认展示，true隐藏 */
  hideInEditForm?: boolean;
  cellRenderer?: string;
  formItemRenderer?: string;
  /** 配置将区间类型的时间字段分解成哪些（哪两个）字段 */
  $decomposeParams?: [{ name: string; dayjsFormat: string }, { name: string; dayjsFormat: string }];
  valueEnumDataSource?: string;
  valueEnumDataSourceTransformer?: ((data) => any) | MciInternalValueObject;
}

/**
 * 剔除嵌套的类型
 *
 * @example
 * type TCustom = { a: number }
 *
 * ```ts
 * type TTest = {
 *   a: TCustom | number;
 *   b: {
 *     c: TCustom | number;
 *   }
 * }
 *
 * type TTestResult = ExcludeNested<TTest, TCustom>
 * type TTestResultExpect = {
 *   a: number;
 *   b: {
 *     c: number;
 *   }
 *
 * ```
 *
 */
type ExcludeNested<T, U> = {
  // 1. 剔除联合类型中的 U 类型
  // 2. 判断这个类型是否是 function 类型（因为 function 也是 object）
  // 3. 判断是否是 object 类型，是则嵌套处理，否则直接使用
  [P in keyof T]: Exclude<T[P], U> extends Function
    ? Exclude<T[P], U>
    : Exclude<T[P], U> extends object
      ? ExcludeNested<Exclude<T[P], U>, U>
      : Exclude<T[P], U>;
};

/**
 * MciProTableSchema
 *
 * @template ServiceName - 支持的 server 列表
 * @template QueryServiceEntity - 查询服务的实体
 */
export interface MciProTableSchema<ServiceName = string, QueryServiceEntity = Record<string, any>> {
  dataSource?: {
    [key: string]: {
      serviceName: ServiceName;

      // TODO: 感觉给用户自行设置 postParmas 或者 queryParam?
      //   因为就遇到一个 post 请求，但是要放到 query 上的
      //   下架那个案例，只是需要传递 id，但是后端觉得 id 太短了，没必要放到 body 里面
      params?: Record<string, any>;
      httpMethod?: 'get' | 'post';

      cache?: boolean;

      postTransformer?: ((data: any) => any) | MciInternalValueObject;

      // 临时 mock，不要过渡依赖
      mockRes?: any;
    };
  };
  service: {
    // 增
    create?: {
      serviceName: ServiceName;
      // 在真正提交到后端之前，会调用这个函数，拿到返回结果作为 requestbody 的值
      transformer?: ((values: any) => any) | MciInternalValueObject;
    };
    // 删
    remove?: {
      serviceName: ServiceName;
      // 读取 row entity 中的哪个字段作为删除的key
      idFieldName?: string;
      confirmText?: string;
    };
    // 改
    edit?: {
      serviceName: ServiceName;
      // 在真正提交到后端之前，会调用这个函数，拿到返回结果作为 requestbody 的值
      transformer?: ((values: any) => any) | MciInternalValueObject;
    };
    // 查 - 筛选
    query: {
      serviceName: ServiceName;
      httpMethod?: 'get' | 'post';
      params?: Record<string, any>; // 强制指定参数
      paramPreprocessor?: ((params: any, ctx: IProviderCtxProps) => any) | MciInternalValueObject;
      // 灌注到 pro-table 的数据必须符合这个规范。
      // 如果后端返回的数据不符合的话，那么需要我们自己去做转换
      transformer?:
        | ((response: any) => {
            data: any[];
            success: boolean;
            total: number;
          })
        | MciInternalValueObject;

      /**
       * 临时强制mock，不要过渡依赖
       * @desc 现在mock链路比较长，配路径，配 mock 行为，后端改文档等等
       */
      mockRes?: any;

      /** 是否开启过滤 */
      noFilter?: boolean;

      searchConfig?: {
        labelWidth?: number | 'auto';
        defaultCollapsed?: boolean;
        onGetFormRef?: (formRef: React.MutableRefObject<ProFormInstance>) => void | MciInternalValueObject;
        formConfig?: ProTableProps<QueryServiceEntity, any>['form'];
      };
    };

    // 查 - 查看详情
    view?: {
      // flow - 自上而下的流式展示；hierarchical - 用 tab + 分组来进行结构化的展示
      uiMode?: 'flow' | 'hierarchical';
      // 如果 uiMode 的值为 'hierarchical'， tabs 字段一定要配置
      tabs?: Array<{
        tabName: string;
        serviceName: ServiceName;
        params?: Record<string, any>;
        // TODO: 为什么声明一个函数参数也会触发 eslint no-unused-vars ？
        // TODO: 命名规范，preprocessor transformer 等等，或者合并到 params
        paramsTransformer?: ((record: any) => any) | MciInternalValueObject;
        httpMethod?: 'get' | 'post';
        mockRes?: any; // 测试用
        transformer?: ((res: any) => any) | MciInternalValueObject;
        // sectionConfig?: [{ title: '基本信息'; key: 'basic' }, { title: '基本信息2'; key: 'basic2' }];
        sectionConfig?: Array<{ title: string; key: string }>;
        columnSetting: Array<MciProColumns<QueryServiceEntity> & { sectionKey?: string }>; // TODO: dev 很多字段联动，需要校验机制
        columnCount?: number; // 一行多少个字段，默认 2
        // 对应的是注册到 root provider 或者 page provider context的自定义组件的组件名
        renderer?: string; // (resData) => void
      }>;
      drawer?: {
        width?: number;
      };
    };

    export?: {
      serviceName: ServiceName;
      httpMethod?: 'get' | 'post';
    };
  };
  toolBarActions?: Array<
    | {
        text: string;
        clickAction?: string;
        props?: ButtonProps;
      }
    | string
  >;
  rowSelection?: {
    rowKey?: string;
    actionRenderers: string[];
  };
  columnSetting?: Array<MciProColumns<QueryServiceEntity>>;
  tableSetting: {
    title: string;
    pageSize: number;
    scrollX?: number;
    hideToolBar?: boolean;
    rowKey?: string;
  };
}

// TODO: 似乎没有这个 Context，毕竟只是 interface，而且 Context 应该不支持继承的？
//     另外 MciProTable 使用的 ctx 也不是这个
export interface MciProtableContext extends IProviderCtxProps {
  searchForm: Record<string, any>;
}
export type MciProTableProps = ExcludeNested<MciProTableSchema, MciInternalValueObject>;

export type RowSelectionAction = React.FunctionComponent<{
  selectedRows: Record<string, any>[];
  clearAllSelected: () => void;
  reload?: () => void;
}>;

export interface IProviderCtxProps {
  /** 内置的 react hook */
  // eslint-disable-next-line no-unused-vars
  hookMap?: Record<string, (...params: any[]) => any>;
  /** 接口列表 */
  apiMap?: Record<string, any>;
  /** format列表 */
  // eslint-disable-next-line no-unused-vars
  cellRendererMap?: Record<string, (value: any, record: any) => React.ReactNode>;
  // eslint-disable-next-line no-unused-vars
  formItemRendererMap?: Record<string, (value: any, record: any) => React.ReactNode>;
  tabPanelRendererMap?: Record<string, (tab: any) => React.ReactNode>;
  /** action列表 */
  toolBarActionMap?: Record<string, any>;
  rowSelectionActionMap?: Record<string, RowSelectionAction>;
  // TODO: 废弃这个 map，因为它的语义不够明确
  customizeComponentMap?: Record<string, any>;
  actionMap?: Record<string, (opt: any) => React.ReactNode>;
  components?: Record<string, any>;
  actionFunctions?: Record<string, any>;
  children?: React.ReactNode;
  userInfo?: Record<string, any>;

  /**
   * 用于给表单注入一些动态数据
   *
   * @example 父 table 打开指定的 id 的 table
   * 如果父schemea 打开子 schema，子 schema 是动态的需要一些信息注入
   */
  extraInfo?: {
    columns?: Record<string, any>;
    tabs?: Record<string, any>;
    record?: Record<string, any>;
    callbackMap?: Record<string, (...args: any[]) => void>;
  };
}

export type PluginType = keyof Omit<IProviderCtxProps, 'children' | 'userInfo'>;
