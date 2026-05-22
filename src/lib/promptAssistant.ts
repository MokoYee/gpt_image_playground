export interface PromptAssistantCategory {
  id: string
  label: string
}

export interface PromptAssistantItem {
  id: string
  categoryId: string
  title: string
  prompt: string
  tags: string[]
}

export const promptAssistantCategories: PromptAssistantCategory[] = [
  { id: 'all', label: '全部' },
  { id: 'portrait', label: '人像角色' },
  { id: 'cinematic', label: '电影场景' },
  { id: 'product', label: '产品商业' },
  { id: 'anime', label: '动漫插画' },
  { id: 'architecture', label: '建筑空间' },
  { id: 'concept', label: '概念设计' },
]

export const promptAssistantSources = [
  {
    name: 'DiffusionDB',
    url: 'https://github.com/poloclub/diffusiondb',
  },
  {
    name: 'Awesome Stable Diffusion Prompts',
    url: 'https://github.com/ai-collection/awesome-stable-diffusion-prompts',
  },
]

export const promptAssistantItems: PromptAssistantItem[] = [
  {
    id: 'portrait-neon-warrior',
    categoryId: 'portrait',
    title: '霓虹机甲女战士',
    prompt: '一位身穿未来机甲的女性战士，站在雨后霓虹城市天台，长发飘动，手持能量剑，电影感侧逆光，潮湿金属质感，赛博朋克氛围，浅景深，超清细节，高级调色',
    tags: ['赛博朋克', '机甲', '女性角色', '电影感'],
  },
  {
    id: 'portrait-editorial',
    categoryId: 'portrait',
    title: '高级时装人像',
    prompt: '高级时装杂志封面人像，模特穿着结构感黑色礼服，极简灰色摄影棚，柔和轮廓光，干净皮肤质感，85mm 镜头，浅景深，克制奢华，真实摄影风格',
    tags: ['时装', '棚拍', '人像', '杂志'],
  },
  {
    id: 'portrait-fantasy-mage',
    categoryId: 'portrait',
    title: '森林法师角色',
    prompt: '年轻森林法师站在古老巨树下，披着苔藓纹理斗篷，手中漂浮微光符文，晨雾穿过树冠，精致面部细节，奇幻角色设定，写实插画，柔和绿色与金色光线',
    tags: ['奇幻', '法师', '角色设定', '森林'],
  },
  {
    id: 'cinematic-rain-street',
    categoryId: 'cinematic',
    title: '雨夜街头电影帧',
    prompt: '雨夜城市街头电影剧照，湿润柏油路反射红蓝霓虹，一个孤独人物撑伞走过路口，远处车灯虚化，低机位构图，强烈氛围光，真实胶片颗粒，宽银幕比例',
    tags: ['雨夜', '街头', '电影帧', '胶片'],
  },
  {
    id: 'cinematic-desert-crash',
    categoryId: 'cinematic',
    title: '沙漠科幻残骸',
    prompt: '广阔沙漠中的坠毁太空船残骸，救援队穿越沙尘走向巨大引擎，夕阳逆光，宏大尺度，科幻电影概念图，细节丰富，空气透视，橙蓝对比色',
    tags: ['科幻', '沙漠', '残骸', '宏大场景'],
  },
  {
    id: 'cinematic-mountain-temple',
    categoryId: 'cinematic',
    title: '雪山寺庙远景',
    prompt: '雪山悬崖上的古老寺庙，云雾从山谷升起，僧人点灯经过长阶，日出金光照亮屋檐，史诗感远景，电影级构图，高动态范围，宁静而神秘',
    tags: ['雪山', '寺庙', '史诗', '日出'],
  },
  {
    id: 'product-watch',
    categoryId: 'product',
    title: '奢华腕表广告',
    prompt: '奢华机械腕表产品广告，黑色抛光石材台面，微距镜头展示表盘齿轮与蓝钢指针，窄束硬光，高反差阴影，精致金属反射，商业摄影，干净背景',
    tags: ['产品', '腕表', '商业摄影', '微距'],
  },
  {
    id: 'product-perfume',
    categoryId: 'product',
    title: '香水海报',
    prompt: '透明玻璃香水瓶悬浮在浅蓝水波之间，周围有白色花瓣与细小水珠，柔和高光，清新高端品牌海报，中心构图，干净留白，精致反射',
    tags: ['香水', '海报', '清新', '品牌'],
  },
  {
    id: 'product-sneaker',
    categoryId: 'product',
    title: '运动鞋动感广告',
    prompt: '未来感运动鞋产品图，鞋身悬浮在深色背景中，周围有速度轨迹与细碎尘埃，蓝紫边缘光，鞋底纹理清晰，商业广告构图，动感但干净',
    tags: ['运动鞋', '广告', '动感', '未来感'],
  },
  {
    id: 'anime-rooftop',
    categoryId: 'anime',
    title: '日落天台少女',
    prompt: '动画电影风格，少女坐在学校天台边缘看日落，风吹动校服和头发，天空是粉橙渐变，远处城市温柔虚化，细腻线稿，温暖治愈氛围，画面干净',
    tags: ['动漫', '日落', '少女', '治愈'],
  },
  {
    id: 'anime-mecha-hangar',
    categoryId: 'anime',
    title: '机甲整备库',
    prompt: '大型机甲停在地下整备库，工程师在脚手架上检修装甲，冷色工业灯光，电缆与蒸汽细节丰富，日式科幻动画设定图，清晰层次，宽画幅',
    tags: ['机甲', '设定图', '科幻', '工业'],
  },
  {
    id: 'anime-food-stall',
    categoryId: 'anime',
    title: '深夜拉面摊',
    prompt: '深夜街角拉面摊，暖黄色灯笼照亮蒸汽，客人坐在雨棚下吃面，湿润街道反光，动画电影背景美术，生活感细节，温柔夜色',
    tags: ['动漫背景', '夜晚', '食物', '街景'],
  },
  {
    id: 'architecture-gallery',
    categoryId: 'architecture',
    title: '极简艺术馆',
    prompt: '极简当代艺术馆室内，大面积白色墙面与天窗自然光，浅色石材地面，少量雕塑陈列，干净几何线条，建筑摄影，真实材质，安静高级',
    tags: ['建筑', '室内', '极简', '艺术馆'],
  },
  {
    id: 'architecture-cabin',
    categoryId: 'architecture',
    title: '湖畔玻璃木屋',
    prompt: '湖畔现代玻璃木屋，室内暖光从落地窗透出，外面是松树林与薄雾湖面，傍晚蓝调时刻，建筑可视化，真实木材纹理，宁静度假氛围',
    tags: ['建筑', '木屋', '湖泊', '傍晚'],
  },
  {
    id: 'architecture-future-library',
    categoryId: 'architecture',
    title: '未来图书馆',
    prompt: '未来公共图书馆中庭，环形书架层层上升，中央有悬浮阅读平台，柔和天光从穹顶落下，白色金属与温润木材结合，空间宏大，建筑概念渲染',
    tags: ['未来建筑', '图书馆', '中庭', '概念'],
  },
  {
    id: 'concept-vehicle',
    categoryId: 'concept',
    title: '火星探测车',
    prompt: '火星基地探测车概念设计，六轮越野底盘，模块化货舱，红色尘土覆盖车身，远处可见基地穹顶，工业设计渲染，清晰硬表面细节，真实光照',
    tags: ['概念设计', '载具', '火星', '硬表面'],
  },
  {
    id: 'concept-creature',
    categoryId: 'concept',
    title: '深海生物设定',
    prompt: '深海发光生物概念设定，半透明鳍片与蓝绿色生物荧光，巨大但优雅，悬浮在黑暗海水中，细节丰富，科学幻想风格，神秘氛围',
    tags: ['生物设定', '深海', '荧光', '幻想'],
  },
  {
    id: 'concept-prop',
    categoryId: 'concept',
    title: '魔法道具设计',
    prompt: '古老魔法罗盘道具设计，黄铜外壳，发光蓝色晶体核心，精密刻度与符文雕刻，放在深色皮革桌面上，概念艺术，正交展示感，高清细节',
    tags: ['道具', '魔法', '设定', '黄铜'],
  },
]
