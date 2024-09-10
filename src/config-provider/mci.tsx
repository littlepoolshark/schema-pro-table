import { isEmpty, merge } from 'lodash';
import { FC, ReactNode, createContext, createElement, useContext } from 'react';
import { ExportAction } from '../mci-protable/actionRenderer';

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
  cellRendererMap?: Record<string, (value: any, record: any) => ReactNode>;
  // eslint-disable-next-line no-unused-vars
  formItemRendererMap?: Record<string, (value: any, record: any) => ReactNode>;
  tabPanelRendererMap?: Record<string, (tab: any) => ReactNode>;
  /** action列表 */
  toolBarActionMap?: Record<string, any>;
  rowSelectionActionMap?: Record<string, RowSelectionAction>;
  // TODO: 废弃这个 map，因为它的语义不够明确
  customizeComponentMap?: Record<string, any>;
  actionMap?: Record<string, (opt: any) => ReactNode>;
  components?: Record<string, any>;
  actionFunctions?: Record<string, any>;
  children?: ReactNode;
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

const builtinRootProviderCtx = {
  toolBarActionMap: {
    export: ExportAction,
  },
  userInfo: null,
} as IProviderCtxProps;

const pageProviderCtx = {} as IProviderCtxProps;

const RootProviderCtx = createContext(builtinRootProviderCtx);
const PageProviderCtx = createContext({} as IProviderCtxProps);

/** MciRootProvider, 应用主入口配置 */
export const MciRootProProvider: FC<IProviderCtxProps> = (props) => {
  const { children, ...restProps } = props;
  // TODO: test，嵌套对象是否也能合理的 merge？
  const finalRootProviderCtx = merge(builtinRootProviderCtx, restProps);

  return createElement(
    RootProviderCtx.Provider,
    {
      value: finalRootProviderCtx,
    },
    children,
  );
};
/** MciPageProProvider, 页面主入口配置 */
export const MciPageProProvider: FC<IProviderCtxProps> = (pageProps) => {
  // TODO: 这里是不是其实不用定义 root，只要继续 useContext继续合并？有空讨论下，这样Page支持嵌套了
  const rootCtx = useContext(RootProviderCtx) || {};

  const { children, ...restPageProps } = pageProps;

  if (rootCtx) {
    merge(pageProviderCtx, rootCtx);
  }

  Object.entries(restPageProps).forEach(([prop, value]) => {
    // 如果在rootCtx中有相同的key，则提示错误
    if (rootCtx[prop]) {
      Object.keys(rootCtx[prop]).forEach((key) => {
        if (value[key]) {
          console.warn(`MciPageProProvider中的 ${prop} -> ${key} 与MciRootProProvider中的 ${prop} -> ${key} 重复`);
        }
        pageProviderCtx[prop][key] = value[key] || rootCtx[prop][key];
      });
    } else {
      pageProviderCtx[prop] = value;
    }
  });

  return createElement(
    PageProviderCtx.Provider,
    {
      value: pageProviderCtx,
    },
    children,
  );
};

export const useMciProProvider = () => {
  const rootCtx = useContext(RootProviderCtx);
  const pageCtx = useContext(PageProviderCtx);

  const ctx = isEmpty(pageCtx) ? rootCtx : pageCtx;

  if (!ctx) {
    throw new Error('请在MciPageProProvider中使用useMciProProvider');
  }

  return ctx;
};
