import styled from "styled-components/macro";

export const Wrapper = styled.div<{ displayed: boolean }>`
  resize: both;
  overflow: auto;
  z-index: 1000;
  position: fixed;
  background: black;
  color: white;
  line-height: normal;
  display: ${({ theme, displayed }) => (displayed ? "flex" : "none")};
  flex-direction: column;
`;

export const VideoWrapper = styled.div`
  display: block;
`;

export const CloseButton = styled.div`
  margin-top: 2px;
  margin-right: 2px;
  cursor: pointer;
  color: ${({ theme }) => theme.colors.normalText};
`;

export const Header = styled.div`
  display: flex;
  justify-content: space-between;
  border-bottom-style: solid;
  border-bottom-width: 1px;
  border-bottom-color: ${({ theme }) => theme.colors.neutral[3]};
`;

export const Body = styled.div``;

export const Title = styled.div`
  padding-left: 10px;
  padding-right: 10px;
  display: flex;
  align-items: center;
  background: ${({ theme }) => theme.backgrounds.primary};
  color: ${({ theme }) => theme.colors.onPrimary};
  font-size: ${({ theme }) => theme.fontSizes.medium};
  font-family: ${({ theme }) => theme.fonts.app};
  font-weight: ${({ theme }) => theme.fontWeights.medium};
  text-align: left;
`;

export const LocalVideoWrapper = styled.div`
  padding-right: 40px;
  float: right;
  display: inline-block;
`;

export const RemoteVideoWrapper = styled.div`
  padding-left: 40px;
  float: left;
  display: inline-block;
`;

export const MyVideo = styled.video`
  object-fit: scale-down;
  width: 160px;
  height: 160px;
`;

export const RemoteVideo = styled.video`
  object-fit: scale-down;
  width: 320px;
  height: 320px;
`;
