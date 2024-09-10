import { ExclamationCircleFilled, PlusOutlined } from "@ant-design/icons";
import type { ActionType, ProTableProps } from "@ant-design/pro-components";
import {
  BetaSchemaForm,
  ProDescriptions,
  ProTable,
  TableDropdown,
} from "@ant-design/pro-components";
import {
  Button,
  Drawer,
  Flex,
  FormInstance,
  Popover,
  Spin,
  message,
  Space,
  Tabs,
  TabsProps,
  Modal,
} from "antd";
import {
  Fragment,
  createElement,
  useEffect,
  useRef,
  useState,
  ReactNode,
} from "react";
import { IProviderCtxProps, useMciProProvider } from "../config-provider/mci";
import "./index.scss";
import { MciProTableProps, IMciProActionFull } from "./types";
import {
  isBackendDataValid,
  patchDependenciesJsonLogic,
  isActionColumn,
  checkBeforeRequest,
  extractHttpMethodFromServiceName,
} from "./utils";

interface IMciPopOverProps {
  onConfirm: () => void;
  title?: string;
  description: string;
  cancelText?: string;
  confirmText?: string;
  triggerText: string;
  disabled?: boolean;
}

interface IMciModalProps {
  isOpen: boolean;
  title?: string;
  content?: string;
  okText?: string;
  onOk?: () => void;
  onCancel?: () => void;
}

function PopoverConfirm(props: IMciPopOverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const close = () => {
    setIsOpen(false);
  };
  const open = () => {
    setIsOpen(true);
  };

  useEffect(function () {
    document.body.addEventListener("click", close);
    return () => {
      document.body.removeEventListener("click", close);
    };
  }, []);

  const title = props.title || "提示";
  const description = props.description;
  const cancelText = props.cancelText || "取消";
  const confirmText = props.confirmText || "确定";
  const triggerText = props.triggerText;

  return (
    <Popover
      key="remove"
      title={
        <Flex align="center" gap={4}>
          <ExclamationCircleFilled style={{ color: "#faad14" }} />
          {title}
        </Flex>
      }
      content={
        <Flex vertical gap={16}>
          <div style={{ whiteSpace: "pre-wrap" }}>{description}</div>
          <Flex align="center" justify="flex-end" gap={8}>
            <Button size="small" type="default" onClick={close}>
              {cancelText}
            </Button>
            <Button
              size="small"
              type="primary"
              onClick={() => {
                props?.onConfirm();
                close();
              }}
            >
              {confirmText}
            </Button>
          </Flex>
        </Flex>
      }
      trigger="click"
      open={isOpen}
    >
      {/* TODO: 这里接入 tailwind intelisense */}
      <Button
        onClick={(e) => {
          e.stopPropagation();
          open();
        }}
        disabled={props.disabled}
        type="link"
        style={{ padding: 0 }}
      >
        {triggerText}
      </Button>
    </Popover>
  );
}

// dateSource 是全局配置，一般只会请求一次就够了
// 不过可能 params 会不同，这个开发给用户控制
const loadedDataSourceMap: Record<string, any> = {};

// 如果有需要，可以挪动到别的地方
function useLoadDataSource(
  ctx: IProviderCtxProps,
  dataSource?: MciProTableProps["dataSource"]
) {
  const [loading, setLoading] = useState(true);
  const [dataMap, setDataMap] = useState({});
  const [errorMap, setErrorMap] = useState({});
  const keys = dataSource ? Object.keys(dataSource) : [];

  let count = 0;
  const checkFinish = () => {
    if (count === keys.length) {
      setLoading(false);
    }
  };
  useEffect(() => {
    if (!keys.length) {
      setLoading(false);
      return;
    }

    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const config = dataSource[key];
      const { serviceName, params } = config;

      // TODO: 有代码重复，有空可以优化下
      const httpMethod =
        config.httpMethod?.toLowerCase() ||
        extractHttpMethodFromServiceName(serviceName) ||
        "get";
      if (!["get", "post"].includes(httpMethod)) {
        throw new Error(`Unsupport http method: '${httpMethod}'`);
      }

      // TODO: 如果可以，增加 cancel handle，耦合到组件 lifecycle中
      let promise: Promise<any>;

      // TODO: 即使是使用了 cache，切换子菜单表单还是会闪烁一下，如果有条件可以优化了
      if (loadedDataSourceMap[serviceName]) {
        promise = new Promise((resolve) => {
          console.log(`使用缓存数据 sourceName: ${serviceName}`);
          resolve(loadedDataSourceMap[serviceName]);
        });
      } else if (config.mockRes) {
        promise = new Promise(async (resolve) => {
          console.warn("临时强制本地代码mock数据");
          // await sleep(200);
          resolve(config.mockRes);
        });
      } else {
        promise = ctx.apiMap[serviceName]({
          [httpMethod === "get" ? "queryParams" : "requestBody"]: params,
        });
      }

      promise
        .then((res) => {
          if (config.cache) {
            // FIXME: 缓存需要按照 key 来进行缓存，因为不同业务的枚举列表不一样，注意克隆，如果有 transformer
            console.warn("枚举缓存暂不支持，有待优化");
            // loadedDataSourceMap[serviceName] = res;
          }

          if (config.postTransformer) {
            res = config.postTransformer(res);
          }

          // TODO: check code not 0000

          setDataMap((prev) => {
            return {
              ...prev,
              // TODO: error 要解构吗
              // @NOTE: 对于配置了 postTransformer() 转换器的场景而言，没必要要求人家最外层再套一层 data 字段了
              [key]: res.data, // 解构后端data字段
            };
          });
          count++;
          checkFinish();
        })
        .catch((e) => {
          console.error("loadDataSource error: ", e);
          setErrorMap((prev) => {
            return {
              ...prev,
              [key]: e,
            };
          });
          // count++;
          checkFinish();
        });
    }
  }, []);

  return { loading, dataMap, errorMap };
}

export default function MciProTable(props: MciProTableProps) {
  const {
    service,
    columnSetting,
    tableSetting,
    toolBarActions,
    dataSource,
    rowSelection,
  } = props;
  const rowKey = tableSetting?.rowKey;
  const { create, edit, query, remove, view } = service;
  const actionRef = useRef<ActionType>();
  const ctx = useMciProProvider();
  const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState(false);
  const [isEditDrawerOpen, setIsEditDrawerOpen] = useState(false);
  const [currentDetailItem, setCurrentDetailItem] =
    useState<Record<string, any>>();
  const createFormRef = useRef<FormInstance>();
  const editFormRef = useRef<FormInstance>();
  const searchFormRef = useRef<FormInstance>();
  const [searchForm, setSearchForm] = useState<Record<string, any>>({});
  const [isDeleting, setIsDeleting] = useState(false);
  const curEditRecordRef = useRef(null);
  const [pageSize, setPageSize] = useState(tableSetting.pageSize);
  const [modalData, setMode] = useState<IMciModalProps>({
    isOpen: false,
  });
  // TODO: 应该叫做 pageIndex 短一些？
  const [currentPageIndex, setCurrentPageIndex] = useState(1);
  const [rowSelectionMap, setRowSelectionMap] = useState(() => {
    const m = new Map<
      number,
      { selectedRowKeys: React.Key[]; selectedRows: Record<string, any>[] }
    >();
    m.set(1, {
      selectedRowKeys: [],
      selectedRows: [],
    });

    return m;
  });
  const [isManualLoading, setIsManualLoading] = useState(false);

  const isCreateConfigured = !!create;

  const {
    loading: dataSourceLoading,
    dataMap: dataSourceMap,
    errorMap: dataSourceErrorMap,
  } = useLoadDataSource(ctx, dataSource);

  /** ---------------- 在这条分割线下面写「计算属性」的计算逻辑 ------------------------- **/
  const totalSelectedRowKeys = [];
  const totalSelectedRows = [];
  for (const { selectedRowKeys, selectedRows } of rowSelectionMap.values()) {
    totalSelectedRowKeys.push(...selectedRowKeys);
    totalSelectedRows.push(...selectedRows);
  }
  const currentSelectedRowsCount =
    rowSelectionMap.get(currentPageIndex)?.selectedRowKeys.length || 0;
  const totalSelectedRowsCount = totalSelectedRowKeys.length;

  // const isLoading = dataSourceLoading || isDeleting;

  // TODO: isDeleting 后导致 actionRef 丢失
  const isLoading = dataSourceLoading || isManualLoading;

  const isRowSelectionConfigured = !!rowSelection;

  const { page, size, ...restSearchForm } = searchForm;

  let hasViewAction = false;

  /** action ctx */
  const componentsCtx = {
    actionRef,
    status: {
      loading: isLoading,
      isDeleting,

      isManualLoading,
      setIsManualLoading,
    },
  };

  const newColumnSetting = (columnSetting || []).map((column) => {
    const actionsConfig = column.actions;

    // 操作列绝对不会成为筛选条件，所以在内部，它应该就可以写死
    if (isActionColumn(column)) {
      column.hideInSearch = true;
    }

    if (isActionColumn(column) && Array.isArray(actionsConfig)) {
      if (!hasViewAction) {
        hasViewAction = actionsConfig.includes("view");
      }

      const actionsConfigFull: IMciProActionFull[] = actionsConfig.map(
        (action) => {
          if (typeof action !== "string") return action;
          const map = {
            edit: {
              key: "edit",
              name: "编辑",
            },
            view: {
              key: "view",
              name: "查看",
            },
            remove: {
              key: "remove",
              name: "删除",
            },
          };

          // CHECK
          if (!map[action]) {
            console.error(`未知的 action 配置: ${action}`);
          }

          return map[action];
        }
      );

      column.render = (_, record) => {
        let actionsFull: IMciProActionFull[] = actionsConfigFull.map(
          (action) => {
            switch (action.key) {
              case "edit":
                return {
                  key: "edit",
                  name: action.name,
                  onClick: () => {
                    action.onClick?.(record, ctx);
                    curEditRecordRef.current = { ...record };
                    setIsEditDrawerOpen(true);
                    setTimeout(() => {
                      editFormRef.current.setFieldsValue({ ...record });
                    }, 400);
                  },
                };
              case "view":
                return {
                  key: "view",
                  name: action.name,
                  onClick: () => {
                    action.onClick?.(record, ctx);
                    setCurrentDetailItem({ ...record });
                  },
                };
              case "remove":
                return {
                  key: "remove",
                  name: action.name,
                  onClick: async () => {
                    action.onClick?.(record, ctx);

                    if (!remove) {
                      throw new Error(
                        "Need remove service to support delete action"
                      );
                    }

                    const idFieldName = remove.idFieldName || "id";
                    const idFieldVal = record[idFieldName];

                    // `!idFieldVal` 是一个 falsy 值，但是包含了 id 为 0 的情况，所以要排除这种情况
                    if (idFieldVal !== 0 && !idFieldVal) {
                      throw new Error("发送删除请求的时候，id参数值不能为空");
                    }

                    if (
                      remove.serviceName &&
                      checkBeforeRequest(ctx.apiMap, remove.serviceName)
                    ) {
                      setIsDeleting(true);
                      await ctx.apiMap[service.remove.serviceName]({
                        requestBody: { [idFieldName]: idFieldVal },
                      }).catch((e: any) => {
                        console.error(e);
                        setIsDeleting(false);
                      });
                      setIsDeleting(false);
                      actionRef.current?.reload();
                    }
                  },
                };
              default:
                return {
                  ...action,
                  onClick: () => {
                    action.onClick?.(record, ctx);
                  },
                };
            }
          }
        );

        const finalActions: ReactNode[] = [];
        // TODO: 补充下类型，而且好像发现安装了多个 antd？另外识别的 DropDownProps 不对
        const menuItems: any[] = [];
        for (let i = 0; i < actionsFull.length; i++) {
          const action = actionsFull[i];
          let name = action.name;
          const onClick = action.onClick as () => void;
          const key = "action-" + i;

          const nameRenderer = action.nameRenderer;
          const disabled = action.disabled;

          if (nameRenderer) {
            // 注意，这里是一个工厂函数，返回 reactNode
            name = ctx.actionMap[nameRenderer]({
              record,
              action,
              ctx: componentsCtx,
            });
          } else {
            if (typeof name === "string") {
              if (name === "删除") {
                name = (
                  <PopoverConfirm
                    key={key}
                    onConfirm={onClick}
                    description={remove.confirmText || "确定要删除这条数据吗?"}
                    triggerText="删除"
                  />
                );
              } else if (action.popOver) {
                // 注意，只有 name 为 string 才能使用 PopoverConfirm
                name = (
                  <PopoverConfirm
                    key={key}
                    disabled={disabled}
                    {...action.popOver}
                    onConfirm={onClick}
                    triggerText={name}
                  />
                );
              } else {
                name = (
                  <Button
                    key={key}
                    disabled={disabled}
                    onClick={onClick}
                    style={{ padding: 0 }}
                    type="link"
                  >
                    {name}
                  </Button>
                );
              }
            }
          }

          if (i < 3) {
            finalActions.push(name);
          } else {
            menuItems.push({ name, key });
          }
        }

        if (menuItems.length > 0) {
          finalActions.push(<TableDropdown menus={menuItems} />);
        }

        return finalActions;
      };
    }

    // TODO: 拓展的 `ProColumns` 配置项，采用通用的前缀，或者包裹到一个字段下
    // eg1: mciCellRenderer
    // eg2: mciParams:{ cellRenderer: xxx, formItemRenderer: xxx }
    if (column.cellRenderer) {
      column.render = ctx.cellRendererMap[column.cellRenderer];
    } else {
      // if (!isActionColumn(column)) {
      //   column.render = (dom: any, recode) => {
      //     // NOTE: 不能这么写，比如 int 为 0 的时候，也会被判断为 falsy
      //     //  而且其实这个不需要的，因为设置了 emptyColumnText dom 这里就是 -- 了
      //     // return dom || '--';
      //     return dom;
      //   };
      // }
    }

    // -- valueEnum dataSource
    if (dataSource && column.valueEnumDataSource && !dataSourceLoading) {
      const path = column.valueEnumDataSource.split(".");

      if (dataSource[path[0]]) {
        // dataSourceMap get path value
        let value = dataSourceMap;
        for (let i = 0; i < path.length; i++) {
          value = value[path[i]];
        }

        if (column.valueEnumDataSourceTransformer) {
          value = column.valueEnumDataSourceTransformer(value);
        }

        // TODO: 检查下是否修改了不可变对象的数据？
        column.valueEnum = value;
      } else {
        console.warn("valueEnum 缺少 dataSource 配置，使用默认值");
      }
    }

    if (column.formItemRenderer) {
      column.renderFormItem = ctx.formItemRendererMap[column.formItemRenderer];
    }

    return column;
  });

  const columnSetting4ProDescriptions = newColumnSetting
    .map((column) => {
      const { ...rest } = column;
      return rest;
    })
    .filter((column) => !isActionColumn(column));

  const createFormColumns = patchDependenciesJsonLogic(
    columnSetting,
    "createForm"
  ).filter((col) => col.hideInCreateForm !== true);

  const editFormColumns = patchDependenciesJsonLogic(
    columnSetting,
    "editForm"
  ).filter((col) => col.hideInEditForm !== true);

  const clearAllSelected = () => {
    const newRowSelectionMap = new Map(rowSelectionMap.entries());
    newRowSelectionMap.forEach((value, key, map) => {
      map.set(key, {
        selectedRowKeys: [],
        selectedRows: [],
      });
    });
    setRowSelectionMap(newRowSelectionMap);
  };

  // --- query 相关 ---
  const search: ProTableProps<any, any>["search"] = query.noFilter
    ? false
    : {
        // 固定住宽度，方便对齐
        // labelWidth: 'auto',
        labelWidth: query.searchConfig?.labelWidth ?? 100,
        // 默认展开顶部的 search form
        defaultCollapsed: query.searchConfig?.defaultCollapsed ?? false,
      };

  useEffect(() => {
    query.searchConfig?.onGetFormRef?.(searchFormRef);
  }, []);

  // --- view 相关 ---
  const getViewConfig = () => {
    const uiMode = view?.uiMode || "flow";
    const drawerWidth = view?.drawer?.width || (uiMode === "flow" ? 500 : 800); // hierarchical 默认大一些
    const result: MciProTableProps["service"]["view"] = {
      uiMode,
      tabs: view?.tabs,
      drawer: {
        width: drawerWidth,
      },
    };
    return result;
  };
  const viewConfig = getViewConfig();

  // --- 查询抽屉 ---
  const getViewDrawer = () => {
    const getFlowView = () => {
      return (
        <ProDescriptions
          dataSource={currentDetailItem}
          // TODO: 这里有一个 ts 警告
          columns={columnSetting4ProDescriptions as any}
          column={1}
          emptyText="--"
        />
      );
    };

    const getHierarchicalView = () => {
      const tabs = viewConfig.tabs || [];
      const tabItems: TabsProps["items"] = tabs.map((tab) => {
        const TabPane: React.FC = () => {
          const [isLoading, setIsLoading] = useState(true);
          const [dataSource, setDataSource] = useState({});

          useEffect(() => {
            // 如果配置了 renderer，请求在外部完成
            if (tab.renderer) return;

            // if (!checkBeforeRequest(ctx.apiMap, tab.serviceName)) {
            //   return;
            // }

            let promise: Promise<any>;

            if (tab.mockRes) {
              promise = new Promise(async (resolve) => {
                console.warn("临时强制本地代码mock数据");
                // await sleep(200);
                resolve(tab.mockRes);
              });
            } else {
              let params = tab.params;
              if (!params && tab.paramsTransformer) {
                params = tab.paramsTransformer(currentDetailItem);
              }
              const httpMethod =
                extractHttpMethodFromServiceName(tab.serviceName) || "get";

              promise = ctx.apiMap[tab.serviceName]({
                [httpMethod === "get" ? "queryParams" : "requestBody"]: params,
              });

              // TODO: add transformer to modifyResponse data
            }

            promise
              .then((res) => {
                // TODO: check code not 0000
                setDataSource(res.data);
                setIsLoading(false);
              })
              .catch((e) => {
                // TODO: error 时候展示什么呢
                console.error("error: ", e);
                setIsLoading(false);
              });
          }, []);

          const getProDescriptions = () => {
            const column = tab.columnCount || 2;
            const layout = "vertical";

            // 如果配置了 sectionsConfig，返回多个
            if (!tab.sectionConfig) {
              return (
                <ProDescriptions
                  dataSource={dataSource}
                  // FIXME: type error
                  // @ts-ignore
                  columns={tab.columnSetting}
                  column={column}
                  layout={layout}
                  emptyText="--"
                />
              );
            }

            const sectionConfig = tab.sectionConfig;
            const descriptionArr = sectionConfig.map((section) => {
              const columns = tab.columnSetting.filter((col) => {
                if (!col.sectionKey) {
                  console.error(
                    "配置 sectionConfig 后 columnSetting 中的 sectionKey 不能为空, col:",
                    col
                  );
                }
                return col.sectionKey === section.key;
              });
              return (
                <ProDescriptions
                  key={section.key}
                  dataSource={dataSource}
                  // TODO: mci 很多类型是不兼容的
                  // @ts-ignore
                  columns={columns}
                  column={column}
                  layout={layout}
                  title={section.title}
                  emptyText="--"
                />
              );
            });
            return descriptionArr;
          };

          const getCustomRenderComp = () => {
            const renderFunc = ctx.tabPanelRendererMap[tab.renderer];
            if (!renderFunc) {
              console.error(`找不到 tab renderer: ${tab.renderer}`);
              return null;
            }
            return renderFunc({ tab, record: currentDetailItem });
          };

          return tab.renderer ? (
            getCustomRenderComp()
          ) : (
            <Spin spinning={isLoading}>
              {/* TODO: 其实 ProDescriptions 内部也有一个 request，要不要利用起来 */}
              {!isLoading && getProDescriptions()}
            </Spin>
          );
        };

        return {
          key: tab.tabName,
          label: tab.tabName,
          children: <TabPane />,
        };
      });
      return (
        <Tabs
          items={tabItems}
          // activeKey={currentDetailItem.tabName}
          onChange={(key) => {
            // console.log('tab onChange key: ', key);
            // setCurrentDetailItem({ tabName: key });
          }}
        />
      );
    };

    return (
      hasViewAction && (
        <Drawer
          title="查看详情"
          width={viewConfig.drawer.width}
          open={isDetailDrawerOpen}
          onClose={() => setIsDetailDrawerOpen(false)}
        >
          {viewConfig.uiMode === "flow" ? getFlowView() : getHierarchicalView()}
        </Drawer>
      )
    );
  };

  // --- toolbar 相关 ---
  const toolBarRender = !tableSetting.hideToolBar
    ? () => [
        // 新建表单
        isCreateConfigured ? (
          <BetaSchemaForm
            formRef={createFormRef}
            layoutType="ModalForm"
            className="mci-pro-table-create"
            columns={createFormColumns as any}
            onFinish={async (values) => {
              let tempValues = { ...values };
              if (create.transformer) {
                tempValues = create.transformer(values);
              }
              createFormRef.current?.resetFields();
              await ctx.apiMap[create.serviceName]({
                requestBody: tempValues,
              });
              message.success("新建操作成功");
              actionRef.current?.reload();
              return true;
            }}
            trigger={
              <Button key="button" icon={<PlusOutlined />} type="primary">
                新建
              </Button>
            }
          />
        ) : null,
        toolBarActions?.map((action, index) => {
          if (typeof action === "string") {
            type ServiceKey = keyof typeof service;
            const isConfigured =
              ctx.toolBarActionMap?.[action] &&
              service[action as Exclude<ServiceKey, "view">]?.serviceName;

            return createElement(ctx.toolBarActionMap?.[action], {
              key: index,
              // TODO: 这里貌似有这里是否优化下，比如说统一结构，只是 view 配置了无效
              serviceName: isConfigured
                ? service[action as Exclude<ServiceKey, "view">].serviceName
                : "",
              searchForm,
              actionRef,
              ...ctx,
            });
          } else {
            let props = {} as any;

            // TODO: toolBar 也叫做 action，然而 操作列也叫做 action，有点重名了
            if (ctx.actionFunctions && action.clickAction) {
              props.onClick = ctx.actionFunctions[action.clickAction];
            }

            return createElement(
              Button,
              {
                key: index,
                ...action.props,
                ...props,
              },
              action.text
            );
          }
        }),
      ]
    : false;

  useEffect(
    function () {
      if (currentDetailItem) {
        setIsDetailDrawerOpen(true);
      }
    },
    [currentDetailItem]
  );

  // 筛选条件，数据会变，需要清空选择
  useEffect(
    function () {
      clearAllSelected();
    },
    [JSON.stringify(restSearchForm)]
  );

  // NOTE: 这个配置跟 「批量操作」功能是冲突的，导致了出现「点击勾选一个，却导致勾选全部」的 bug
  // TODO: 为什么需要这个？人家「table 视图，用于定制 ProList，不推荐直接使用」
  // const tableViewRender =
  //   tableSetting.scrollX > 0
  //     ? (prop: any) => {
  //         return <Table {...prop} scroll={{ x: tableSetting.scrollX }} />;
  //       }
  //     : undefined;

  return (
    <Fragment>
      {/* TODO: 其实列表就有一个 loading，有点做重复了 */}
      <Spin spinning={isLoading}>
        {/* TODO: 临时解决方案，protable 中的枚举设置后不能更新了，这里等到拿到正确的值再把 colomn 设置进去 */}
        {!isLoading && (
          <ProTable
            // 这是最简单的方式，yunhua 你搜了大半天没有找到这种配置方式？
            scroll={{ x: tableSetting.scrollX }}
            // NOTE: 这个配置跟 「批量操作」功能是冲突的，导致了出现「点击勾选一个，却导致勾选全部」的 bug
            // TODO: 为什么需要这个？人家明确说明「table 视图，用于定制 ProList，不推荐直接使用」
            // tableViewRender={tableViewRender}
            columns={newColumnSetting}
            actionRef={actionRef}
            cardBordered
            request={async (params) => {
              if (
                !query.mockRes &&
                !checkBeforeRequest(ctx.apiMap, query.serviceName)
              ) {
                return;
              }

              if (query.params) {
                params = { ...params, ...query.params };
              }

              if (query.paramPreprocessor) {
                params = query.paramPreprocessor(params, ctx);
              }

              // TODO: 代码如果请求报错，组件会无限刷新，有空看看优化（如 res = undefined 可以触发）
              let res: any;
              if (query.mockRes) {
                // TODO: chrome 如果安装了 react-dev-tool，会展开 console.warn 展开无法折叠，有空弄一个带颜色标签的打印，不用 console.warn
                console.warn("临时强制本地代码mock数据");
                // await sleep(200);
                res = query.mockRes;
              } else {
                // TODO: 实际上，这并不是控制请求方式，只是控制传参方式，实际请求方式在 apiMap 已经决定了
                const httpMethod =
                  query.httpMethod?.toLowerCase() ||
                  extractHttpMethodFromServiceName(query.serviceName) ||
                  "get";

                if (!["get", "post"].includes(httpMethod)) {
                  throw new Error(`Unsupported http method: '${httpMethod}'`);
                }

                res = await ctx.apiMap[query.serviceName]({
                  [httpMethod === "get" ? "queryParams" : "requestBody"]:
                    params,
                });
              }

              // TODO: 验证非业务性成功是否也会执行到这里
              setSearchForm(params);

              const hadTransformerConfig =
                typeof query.transformer === "function";
              if (!hadTransformerConfig) {
                if (!isBackendDataValid(res)) {
                  throw new Error("后端返回的数据不符合规范");
                }
              } else {
                res = query.transformer(res);
                if (!isBackendDataValid(res)) {
                  throw new Error(
                    "你所配置的 transformer 返回的数据不符合规范"
                  );
                }
              }

              return res;
            }}
            onRequestError={(e) => {
              console.error(e);
            }}
            // 列中空值的占位符
            columnEmptyText="--"
            columnsState={{
              persistenceKey: "pro-table-singe-demos",
              persistenceType: "localStorage",
              defaultValue: {
                option: { fixed: "right", disable: true },
              },
            }}
            // TOOD: 是否改到配置到外面的
            rowKey={rowKey || rowSelection?.rowKey || "id"}
            search={search}
            defaultSize="small"
            options={{
              setting: {
                listsHeight: 400,
              },
            }}
            form={{
              syncToUrl: false,
              // TODO: 其实wrap后很难看，官方没有ellipse的配置，有空看自行封装一个
              //       另外发现 labelCol 配置不生效了，不知道是不是 search 覆盖了
              labelWrap: true,
              ...query.searchConfig?.formConfig,
            }}
            // 获取到查询表单的 form
            formRef={searchFormRef}
            pagination={{
              pageSize,
              onChange: (page, pageSize) => {
                setCurrentPageIndex(page);
                setPageSize(pageSize);
              },
            }}
            dateFormatter="string"
            headerTitle={tableSetting.title}
            toolBarRender={toolBarRender}
            rowSelection={
              isRowSelectionConfigured
                ? {
                    onChange(selectedRowKeys, selectedRows) {
                      setRowSelectionMap((m) => {
                        const _m = new Map(m.entries());
                        _m.set(currentPageIndex, {
                          selectedRowKeys,
                          selectedRows,
                        });
                        return _m;
                      });
                    },
                    selectedRowKeys: totalSelectedRowKeys,
                  }
                : false
            }
            /**
             * @note: 因为 mciProtable 的 selectedRowKeys state 的数据结构故意跟 protable selectedRowKeys 设计得（因为存在分页请求的原因）不一样，
             *        所以，下面 tableAlertRender 配置的 `selectedRowKeys` 和 `selectedRows` 实参是用不上了
             */
            tableAlertRender={({
              selectedRowKeys,
              selectedRows,
              onCleanSelected: clearCurrentPageSelected,
            }) => {
              return (
                <Space size={24}>
                  <span>
                    当前分页：已选 {currentSelectedRowsCount} 项
                    {currentSelectedRowsCount > 0 ? (
                      <a
                        style={{ marginInlineStart: 8 }}
                        onClick={clearCurrentPageSelected}
                      >
                        取消选择
                      </a>
                    ) : null}
                  </span>
                  <span>|</span>
                  <span>
                    总共选择：{totalSelectedRowKeys.length} 项
                    {totalSelectedRowsCount > 0 ? (
                      <a
                        style={{ marginInlineStart: 8 }}
                        onClick={() => {
                          clearCurrentPageSelected();
                          clearAllSelected();
                        }}
                      >
                        取消选择
                      </a>
                    ) : null}
                  </span>
                </Space>
              );
            }}
            tableAlertOptionRender={() => {
              if (
                isRowSelectionConfigured &&
                rowSelection.actionRenderers?.length > 0
              ) {
                return (
                  <Space size={16}>
                    {rowSelection.actionRenderers.map((actionRenderer) => {
                      if (!ctx.rowSelectionActionMap[actionRenderer]) {
                        throw Error(
                          `Can\'t not find action renderer('${actionRenderer}') in rowSelectionActionMap, did you forget to inject?`
                        );
                      }
                      return createElement(
                        ctx.rowSelectionActionMap[actionRenderer],
                        {
                          key: actionRenderer,
                          selectedRows: totalSelectedRows,
                          clearAllSelected: clearAllSelected,
                          reload: actionRef.current?.reload,
                        }
                      );
                    })}
                  </Space>
                );
              }
              return null;
            }}
          />
        )}
      </Spin>

      {/* 编辑表单 */}
      <BetaSchemaForm
        className="mci-pro-table-edit"
        open={isEditDrawerOpen}
        formRef={editFormRef}
        layoutType="ModalForm"
        columns={editFormColumns as any}
        onOpenChange={(state) => {
          if (state === false) {
            editFormRef.current?.resetFields();
            setIsEditDrawerOpen(false);
          }
        }}
        onFinish={async (values) => {
          if (!curEditRecordRef.current) return true;

          // 需要全量数据，如 id
          // let tempValues = { ...values };
          let tempValues = { ...curEditRecordRef.current, ...values };

          if (edit.transformer) {
            tempValues = edit.transformer(tempValues);
          }

          // TODO: 失败时候停在这个界面，不关闭
          await ctx.apiMap[edit.serviceName]({
            requestBody: tempValues,
          });
          editFormRef.current?.resetFields();
          actionRef.current?.reload();
          setIsEditDrawerOpen(false);
          message.success("编辑操作成功");
          return true;
        }}
      />

      {/* TODO: 要抽成组件，否则会多次请求，但是已经没空修 */}
      {getViewDrawer()}

      <Modal open={modalData.isOpen}></Modal>
    </Fragment>
  );
}
