import { describe, expect, it } from "vitest";

import { toCreateDouyinAccountPayload } from "@/lib/account-payload";

describe("toCreateDouyinAccountPayload", () => {
  it("includes secUserId from preview data", () => {
    const payload = toCreateDouyinAccountPayload({
      profileUrl: "https://www.douyin.com/user/tester",
      secUserId: "sec_123",
      nickname: "测试账号",
      avatar: "https://cdn.example.com/avatar.jpg",
      bio: "简介",
      signature: "签名",
      followersCount: 100,
      followingCount: 20,
      likesCount: 300,
      videosCount: 10,
      douyinNumber: "49001906753",
      ipLocation: "IP属地：湖北",
      age: 36,
      province: "湖北",
      city: "武汉",
      verificationLabel: "慧研智投科技有限公司一般证券从业人员",
      verificationIconUrl: "https://lf3-static.bytednsdoc.com/yellow-v.png",
      verificationType: 0,
    });

    expect(payload).toEqual({
      profileUrl: "https://www.douyin.com/user/tester",
      secUserId: "sec_123",
      nickname: "测试账号",
      avatar: "https://cdn.example.com/avatar.jpg",
      bio: "简介",
      signature: "签名",
      followersCount: 100,
      followingCount: 20,
      likesCount: 300,
      videosCount: 10,
      douyinNumber: "49001906753",
      ipLocation: "IP属地：湖北",
      age: 36,
      province: "湖北",
      city: "武汉",
      verificationLabel: "慧研智投科技有限公司一般证券从业人员",
      verificationIconUrl: "https://lf3-static.bytednsdoc.com/yellow-v.png",
      verificationType: 0,
    });
  });

  it("normalizes negative numeric preview fields before submit", () => {
    const payload = toCreateDouyinAccountPayload({
      profileUrl: "https://www.douyin.com/user/tester",
      secUserId: "sec_123",
      nickname: "测试账号",
      avatar: "https://cdn.example.com/avatar.jpg",
      bio: null,
      signature: null,
      followersCount: -1,
      followingCount: -5,
      likesCount: -10,
      videosCount: -3,
      douyinNumber: "49001906753",
      ipLocation: null,
      age: -1,
      province: null,
      city: null,
      verificationLabel: null,
      verificationIconUrl: null,
      verificationType: null,
    });

    expect(payload).toMatchObject({
      followersCount: 0,
      followingCount: 0,
      likesCount: 0,
      videosCount: 0,
      age: null,
    });
  });
});
