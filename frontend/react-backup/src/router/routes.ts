import Frame2310 from "@/views/Frame2310";
import Frame2440 from "@/views/Frame2440";
import Frame2175 from "@/views/Frame2175";
import Frame2529 from "@/views/Frame2529";
import Frame2722 from "@/views/Frame2722";
import Frame228 from "@/views/Frame228";
import Frame2611 from "@/views/Frame2611";
import Frame22 from "@/views/Frame22";

export const routes = [{
          path: "/frame2310",
          component: Frame2310,
          guid: "2:310",
        },
{
          path: "/frame2440",
          component: Frame2440,
          guid: "2:440",
        },
{
          path: "/frame2175",
          component: Frame2175,
          guid: "2:175",
        },
{
          path: "/frame2529",
          component: Frame2529,
          guid: "2:529",
        },
{
          path: "/frame2722",
          component: Frame2722,
          guid: "2:722",
        },
{
          path: "/frame228",
          component: Frame228,
          guid: "2:28",
        },
{
          path: "/frame2611",
          component: Frame2611,
          guid: "2:611",
        },
{
          path: "/",
          component: Frame22,
          guid: "2:2",
        }];


export const guidPathMap = new Map(
  routes.map((item) => [item.guid, item.path])
);
export const pathGuidMap = new Map(
  routes.map((item) => [item.path, item.guid])
);

export const getPathByGuid = (guid: string) => {
  return guidPathMap.get(guid) || "";
};

export const getGuidByPath = (path: string) => {
  return pathGuidMap.get(path) || "";
};
