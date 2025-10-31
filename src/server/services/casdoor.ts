import { SDK } from 'casdoor-nodejs-sdk';

// Casdoor 配置
const casdoorConfig = {
  appName: process.env.AUTH_CASDOOR_ID || '',
  certificate: process.env.AUTH_CASDOOR_CERTIFICATE || '', // 从环境变量读取证书
  clientId: process.env.AUTH_CASDOOR_ID || '',
  clientSecret: process.env.AUTH_CASDOOR_SECRET || '',
  endpoint: process.env.AUTH_CASDOOR_ISSUER || '',
  orgName: process.env.AUTH_CASDOOR_ORGANIZATION || 'built-in', // 从环境变量读取组织名称
};

// 开发环境下打印配置信息（隐藏敏感信息）
if (process.env.NODE_ENV === 'development') {
  console.log('[Casdoor] Configuration loaded:', {
    clientId: casdoorConfig.clientId ? '***' + casdoorConfig.clientId.slice(-4) : 'NOT SET',
    endpoint: casdoorConfig.endpoint,
    hasCertificate: !!casdoorConfig.certificate,
    hasClientSecret: !!casdoorConfig.clientSecret,
    orgName: casdoorConfig.orgName,
  });
}

/**
 * Casdoor 服务类
 * 用于管理 Casdoor 用户的创建、更新、删除等操作
 */
export class CasdoorService {
  private sdk: SDK;

  constructor() {
    this.sdk = new SDK(casdoorConfig);
  }

  /**
   * 创建新用户
   * @param userData 用户数据
   * @returns 创建的用户信息
   */
  async createUser(userData: {
    displayName?: string;
    email: string;
    name: string;
    password: string;
  }) {
    try {
      const user = {
        createdTime: new Date().toISOString(),
        displayName: userData.displayName || userData.name,
        email: userData.email,
        name: userData.name,
        owner: casdoorConfig.orgName,
        password: userData.password,
        type: 'normal-user',
      } as any;

      const response = await this.sdk.addUser(user);
      return response;
    } catch (error) {
      console.error('Failed to create user in Casdoor:', error);
      throw new Error('创建用户失败: ' + (error instanceof Error ? error.message : '未知错误'));
    }
  }

  /**
   * 更新用户信息
   * @param userId Casdoor 用户名
   * @param updates 更新的字段
   */
  async updateUser(userId: string, updates: { displayName?: string; isForbidden?: boolean }) {
    try {
      const userResponse = await this.sdk.getUser(userId);
      if (!userResponse || !userResponse.data || !userResponse.data.data) {
        throw new Error('用户不存在');
      }

      const user = userResponse.data.data;
      const updatedUser = {
        ...user,
        ...updates,
      };

      const response = await this.sdk.updateUser(updatedUser);
      return response;
    } catch (error) {
      console.error('Failed to update user in Casdoor:', error);
      throw new Error('更新用户失败: ' + (error instanceof Error ? error.message : '未知错误'));
    }
  }

  /**
   * 禁用用户
   * @param userId Casdoor 用户名
   */
  async disableUser(userId: string) {
    return this.updateUser(userId, { isForbidden: true });
  }

  /**
   * 启用用户
   * @param userId Casdoor 用户名
   */
  async enableUser(userId: string) {
    return this.updateUser(userId, { isForbidden: false });
  }

  /**
   * 删除用户
   * @param userId Casdoor 用户名
   */
  async deleteUser(userId: string) {
    try {
      const userResponse = await this.sdk.getUser(userId);
      if (!userResponse || !userResponse.data || !userResponse.data.data) {
        throw new Error('用户不存在');
      }

      const user = userResponse.data.data;
      const response = await this.sdk.deleteUser(user);
      return response;
    } catch (error) {
      console.error('Failed to delete user in Casdoor:', error);
      throw new Error('删除用户失败: ' + (error instanceof Error ? error.message : '未知错误'));
    }
  }

  /**
   * 获取用户信息
   * @param userId Casdoor 用户名
   */
  async getUser(userId: string) {
    try {
      const user = await this.sdk.getUser(userId);
      return user;
    } catch (error) {
      console.error('Failed to get user from Casdoor:', error);
      throw new Error('获取用户失败: ' + (error instanceof Error ? error.message : '未知错误'));
    }
  }
}

// 导出单例
export const casdoorService = new CasdoorService();
